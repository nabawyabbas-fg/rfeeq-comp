"use client";

import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";
import { IconButton } from "./button";

/**
 * The scrim. Its own token rather than a black alpha: the design darkens with a
 * desaturated green so a dialog over the chat does not read as a different
 * product's modal.
 */
function Scrim({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "bg-rf-scrim fixed inset-0 z-50",
        "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-200",
        className,
      )}
    />
  );
}

/**
 * A centred dialog.
 *
 * The prototype calls this a sheet because on a phone the same content arrives
 * from the bottom edge; on the web it is centred at 440px. Built on Radix
 * rather than hand-rolled so focus is trapped, the page behind is inert, and
 * Escape closes — all of which this needs, since the guest wall is the one
 * surface that interrupts a reader mid-question.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  /** Hides the heading visually but keeps it for assistive tech. */
  hideTitle,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  hideTitle?: boolean;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <Scrim />
        <DialogPrimitive.Content
          dir="rtl"
          className={cn(
            "fixed inset-0 z-50 m-auto flex h-fit w-[min(440px,calc(100%-32px))] flex-col",
            "rounded-rf-xl bg-rf-surface shadow-rf-3 max-h-[calc(100%-32px)] overflow-hidden",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-200",
            className,
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-2 ps-6 pe-3 pt-4 pb-2",
              hideTitle && "sr-only",
            )}
          >
            <DialogPrimitive.Title className="font-rf-ui text-rf-h3 text-rf-text font-semibold">
              {title}
            </DialogPrimitive.Title>
            {!hideTitle ? (
              <DialogPrimitive.Close asChild>
                <IconButton aria-label="إغلاق">
                  <Icon name="x" />
                </IconButton>
              </DialogPrimitive.Close>
            ) : null}
          </div>

          {hideTitle ? (
            <DialogPrimitive.Close asChild>
              <IconButton
                aria-label="إغلاق"
                className="absolute end-3 top-3 z-10"
              >
                <Icon name="x" />
              </IconButton>
            </DialogPrimitive.Close>
          ) : null}

          {description ? (
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
          ) : null}

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-6 pb-6",
              hideTitle ? "pt-8" : "pt-2",
            )}
          >
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * A drawer sliding in from the inline-start edge — the right, in this RTL app.
 *
 * Used for history on narrow screens, where the sidebar is not rendered. Slides
 * from `start` rather than `end` so the panel opens under the thumb holding the
 * phone, next to the button that opened it.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <Scrim />
        <DialogPrimitive.Content
          dir="rtl"
          className={cn(
            "bg-rf-surface fixed inset-y-0 start-0 z-50 flex w-[86%] max-w-85 flex-col",
            "rounded-e-rf-xl shadow-rf-3",
            "data-open:animate-in data-open:slide-in-from-right",
            "data-closed:animate-out data-closed:slide-out-to-right duration-[250ms]",
          )}
        >
          <div className="flex items-center justify-between p-2 ps-4">
            <DialogPrimitive.Title className="font-rf-ui text-rf-h3 text-rf-text font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton aria-label="إغلاق">
                <Icon name="x" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>

          {footer ? <div className="grid gap-2 px-3 pb-2">{footer}</div> : null}

          <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto px-3 pb-5">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
