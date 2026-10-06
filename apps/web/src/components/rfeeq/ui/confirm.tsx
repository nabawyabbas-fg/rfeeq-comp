"use client";

import { AlertDialog as Primitive } from "radix-ui";

import { cn } from "@agentset/ui/cn";

import { Button } from "./button";

/**
 * A destructive action that cannot be undone.
 *
 * A real alert dialog rather than the inline confirmation the prototype draws,
 * and the deviation is deliberate. The inline form is right in the history rail
 * — a 272px column where the row being deleted is the thing on screen, and one
 * chat can be asked for again. It is wrong for "clear every conversation" and
 * "delete this account", which are account-wide and final: those need focus
 * trapped on the choice, an escape route, and a confirm button the keyboard
 * cannot wander past. That is what the project's UI baseline requires of
 * irreversible actions, and the reason it requires it.
 *
 * `AlertDialog`, not `Dialog`: it takes focus to the cancel action rather than
 * the destructive one, and announces itself as an alert.
 */
export function ConfirmDestructive({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "إلغاء",
  isLoading,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  /** An extra acknowledgement the confirm button waits on. */
  children?: React.ReactNode;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay
          className={cn(
            "bg-rf-scrim fixed inset-0 z-50",
            "data-open:animate-in data-open:fade-in-0",
            "data-closed:animate-out data-closed:fade-out-0 duration-200",
          )}
        />
        <Primitive.Content
          dir="rtl"
          className={cn(
            "fixed inset-0 z-50 m-auto grid h-fit w-[min(440px,calc(100%-32px))] gap-3",
            "rounded-rf-xl border-rf-danger bg-rf-surface shadow-rf-3 border-[1.5px] p-6",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-200",
          )}
        >
          <Primitive.Title className="font-rf-ui text-rf-h3 text-rf-text font-semibold">
            {title}
          </Primitive.Title>
          <Primitive.Description className="font-rf-ui text-rf-body-sm text-rf-text-2">
            {description}
          </Primitive.Description>

          {children}

          <div className="mt-2 flex flex-wrap gap-2">
            <Primitive.Action asChild>
              <Button
                variant="danger"
                isLoading={isLoading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </Primitive.Action>
            <Primitive.Cancel asChild>
              <Button variant="secondary">{cancelLabel}</Button>
            </Primitive.Cancel>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
