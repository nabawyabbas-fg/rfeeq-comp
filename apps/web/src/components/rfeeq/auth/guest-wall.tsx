"use client";

import { useRouter } from "next/navigation";
import { GUEST_QUESTION_LIMIT } from "@/contexts/rfeeq-context";

import { Icon } from "../icon";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { AuthMethods } from "./auth-methods";

/**
 * Why the reader is being asked to sign in.
 *
 * Each reason gets its own copy rather than one generic prompt: being stopped
 * mid-question is a different situation from reaching for a feature, and an
 * accurate explanation is the difference between a wall and an invitation. The
 * strings are the prototype's own.
 */
export type GuestWallReason = "limit" | "history" | "share";

const WALL: Record<
  GuestWallReason,
  {
    icon: "clock" | "chat" | "share";
    title: string;
    body: string;
    skip: string;
  }
> = {
  limit: {
    icon: "clock",
    title: "بلغتَ الحد اليومي للأسئلة",
    body: `يمكن للزائر طرح ${GUEST_QUESTION_LIMIT} أسئلة في اليوم، وقد استخدمتَها كلها. سجّل الدخول لمتابعة الأسئلة، أو عُد غدًا.`,
    skip: "ليس الآن",
  },
  history: {
    icon: "chat",
    title: "محادثاتك تُحفظ في حسابك",
    body: "محادثات الزائر تبقى في هذه الجلسة فقط. سجّل الدخول لتحفظها وتعود إليها متى شئت.",
    skip: "متابعة كزائر",
  },
  share: {
    icon: "share",
    title: "سجّل الدخول لمشاركة الإجابة",
    body: "المشاركة تُنشئ رابطًا يفتح الإجابة ومصادرها لمن يصله. هذه الخاصية متاحة لأصحاب الحسابات.",
    skip: "متابعة كزائر",
  },
};

/** The one-line reason shown on the sign-in screen itself. */
export const SIGN_IN_CONTEXT: Record<string, string> = {
  save: "سجّل الدخول لحفظ هذه المحادثة",
  limit: "سجّل الدخول لمتابعة أسئلتك",
  history: "سجّل الدخول لحفظ محادثاتك والعودة إليها",
  share: "سجّل الدخول لمشاركة هذه الإجابة",
};

/**
 * The guest sign-in wall.
 *
 * Dismissible on purpose, including the question limit: the skip button reads
 * «ليس الآن» there rather than «متابعة كزائر», because continuing is exactly
 * what a guest who has used their three questions cannot do — the honest offer
 * is to come back, not to carry on.
 *
 * The note under the methods is load-bearing. A guest about to sign in has a
 * conversation on screen, and the claim-on-sign-in behaviour is real: the
 * server hands chats keyed to the visitor cookie over to the new account.
 */
export function GuestWall({
  reason,
  onClose,
}: {
  reason: GuestWallReason | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const wall = reason ? WALL[reason] : null;

  return (
    <Modal
      open={reason !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={wall?.title ?? ""}
      hideTitle
      description={wall?.body}
    >
      {wall ? (
        <div className="grid gap-3">
          <div className="bg-rf-accent-soft text-rf-accent grid size-14 place-items-center justify-self-center rounded-full">
            <Icon name={wall.icon} size="lg" />
          </div>

          <h3 className="font-rf-ui text-rf-h2 text-rf-text text-center font-semibold">
            {wall.title}
          </h3>
          <p className="font-rf-ui text-rf-body-sm text-rf-text-2 text-center">
            {wall.body}
          </p>

          <AuthMethods onEmail={() => router.push(`/login?ctx=${reason}`)} />

          <p className="font-rf-ui text-rf-text-3 flex items-start justify-center gap-2 text-center text-[13px]/[1.6]">
            <Icon name="info" size="sm" className="mt-[3px]" />
            <span>ستُضاف محادثتك الحالية إلى سجلّك عند تسجيل الدخول.</span>
          </p>

          <Button variant="ghost" block onClick={onClose}>
            {wall.skip}
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}

/**
 * The lighter prompt (A3): a reason line and the three methods, no wall.
 *
 * Used where signing in is an offer rather than a gate — the top bar's own
 * sign-in button.
 */
export function SignInPrompt({
  open,
  context,
  onClose,
}: {
  open: boolean;
  /** Key into SIGN_IN_CONTEXT; omitted for a plain sign-in. */
  context?: keyof typeof SIGN_IN_CONTEXT;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="تسجيل الدخول أو إنشاء حساب"
    >
      <div className="grid gap-3">
        {context ? (
          <p className="rounded-rf-md bg-rf-accent-soft font-rf-ui text-rf-accent flex items-center gap-3 px-4 py-3 text-sm/[1.6] font-semibold">
            <Icon name="info" className="shrink-0" />
            <span>{SIGN_IN_CONTEXT[context]}</span>
          </p>
        ) : null}

        <AuthMethods
          onEmail={() =>
            router.push(context ? `/login?ctx=${context}` : "/login")
          }
        />
      </div>
    </Modal>
  );
}
