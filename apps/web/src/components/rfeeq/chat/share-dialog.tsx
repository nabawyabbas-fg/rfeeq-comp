"use client";

import type { MyUIMessage } from "@/types/ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";

import { Icon } from "../icon";
import { Button } from "../ui/button";
import { State } from "../ui/feedback";
import { Field, Hint, Input } from "../ui/field";
import { Modal } from "../ui/modal";

/**
 * Share a conversation as a read-only link.
 *
 * Shares the conversation rather than the single answer, which is what the
 * stored record is and what the reader of the link needs: an answer detached
 * from the question it answers is not something to hand to someone else, and
 * the sources panel resolves its citations against the whole thread.
 */
export function ShareDialog({
  message,
  chatId,
  onClose,
}: {
  /** The answer the share button was pressed on; null when closed. */
  message: MyUIMessage | null;
  /** The saved conversation, or null if this turn has not been saved yet. */
  chatId: string | null;
  onClose: () => void;
}) {
  const [, copy] = useCopyToClipboard();
  const queryClient = useQueryClient();

  const open = message !== null;

  /*
   * The link is fetched, not stored — which is what makes this effect-free.
   * Minting is idempotent server-side, so asking for the link and creating it
   * are the same request, and the dialog can simply render whatever the query
   * holds.
   */
  const { data: shareId, isPending } = useQuery({
    queryKey: ["rfeeq", "share", chatId],
    enabled: open && Boolean(chatId),
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(`/api/chats/${chatId}/share`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { shareId: string };
      return data.shareId;
    },
  });

  /*
   * Built where it is used rather than held in state: `window` does not exist
   * on the server, and the two places that need an absolute URL are both
   * event handlers, which only ever run in the browser.
   */
  const absoluteUrl = () =>
    shareId ? `${window.location.origin}/s/${shareId}` : "";
  const displayUrl = shareId ? `/s/${shareId}` : "";

  const stopSharing = async () => {
    if (!chatId) return;
    const res = await fetch(`/api/chats/${chatId}/share`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("تعذّر إيقاف المشاركة");
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: ["rfeeq", "share", chatId],
    });
    onClose();
    toast.success("أُوقفت المشاركة، ولم يعد الرابط يعمل");
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="مشاركة الإجابة"
    >
      {!chatId ? (
        <State
          icon="clock"
          title="لم تُحفظ المحادثة بعد"
          description="تُحفظ المحادثة بعد اكتمال الإجابة. انتظر لحظة ثم أعد المحاولة."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <Hint>يفتح الرابط الإجابة ومصادرها للقراءة فقط.</Hint>

          <Field
            label="رابط المشاركة"
            htmlFor="rf-share-link"
            hint="يستطيع أي شخص يملك الرابط قراءة المحادثة"
          >
            <div className="flex gap-2">
              <Input
                id="rf-share-link"
                readOnly
                dir="ltr"
                value={isPending ? "…" : displayUrl}
                className="min-w-0 text-right"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                disabled={!shareId}
                onClick={() => {
                  void copy(absoluteUrl());
                  toast.success("نُسخ الرابط");
                }}
              >
                نسخ
              </Button>
            </div>
          </Field>

          {/* Only where the browser actually has a share sheet; a dead button
              reads worse than an absent one. */}
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <Button
              variant="secondary"
              block
              disabled={!shareId}
              onClick={() => {
                void navigator
                  .share({ url: absoluteUrl(), title: "رفيق" })
                  .catch(() => {
                    // the reader dismissed the sheet; nothing to report
                  });
              }}
            >
              <Icon name="share" />
              مشاركة عبر…
            </Button>
          ) : null}

          <Button
            variant="ghost"
            block
            disabled={!shareId}
            onClick={() => window.open(absoluteUrl(), "_blank", "noopener")}
          >
            <Icon name="ext" mirror />
            معاينة صفحة الرابط
          </Button>

          {shareId ? (
            <Button variant="ghost" block onClick={() => void stopSharing()}>
              إيقاف المشاركة
            </Button>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
