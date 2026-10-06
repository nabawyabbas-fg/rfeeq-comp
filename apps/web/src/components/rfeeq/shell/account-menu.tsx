"use client";

import type { RfeeqViewer } from "@/contexts/rfeeq-context";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";

/**
 * The account pill and its menu.
 *
 * Settings and «عن رفيق» live here rather than in the sidebar: v1.3 moved them
 * out so the rail holds only the chat and its history, which is the whole of
 * what a reader navigates between.
 */
export function AccountMenu({ viewer }: { viewer: RfeeqViewer }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // A click anywhere else closes it, and Escape returns focus to the pill —
  // without the second a keyboard user is left stranded inside a closed menu.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const signOut = async () => {
    await authClient.signOut();
    // a full navigation, not router.refresh(): the shell reads the session on
    // the server, and the chat store has to be dropped along with it
    window.location.assign("/");
  };

  const initial = (viewer.name || "ر").trim().charAt(0);

  return (
    <div className="relative" ref={wrapper}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex min-h-9 cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent",
          "font-rf-ui text-rf-text ps-3 pe-2 text-sm font-medium",
          "hover:bg-rf-surface aria-expanded:bg-rf-surface",
          "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
        )}
      >
        <span
          aria-hidden="true"
          className="bg-rf-accent font-rf-ui text-rf-on-accent grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold"
        >
          {initial}
        </span>
        <span className="max-rf:hidden max-w-35 truncate">{viewer.name}</span>
        <Icon name="chev" size="sm" className="text-rf-text-3 rotate-90" />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute end-0 top-[calc(100%+6px)] z-40 grid min-w-52 gap-0.5 p-1",
            "rounded-rf-md border-rf-line bg-rf-surface shadow-rf-3 border",
          )}
        >
          <MenuItem
            icon="sliders"
            onClick={() => {
              setOpen(false);
              router.push("/settings");
            }}
          >
            الإعدادات
          </MenuItem>
          <MenuItem
            icon="info"
            onClick={() => {
              setOpen(false);
              router.push("/about");
            }}
          >
            عن رفيق
          </MenuItem>
          <MenuItem icon="logout" mirror onClick={() => void signOut()}>
            تسجيل الخروج
          </MenuItem>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  mirror,
  children,
  onClick,
}: {
  icon: "sliders" | "info" | "logout";
  mirror?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-rf-sm flex min-h-10 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3",
        "font-rf-ui text-rf-text text-start text-sm font-medium",
        "hover:bg-rf-surface-2 focus-visible:bg-rf-surface-2 focus-visible:outline-none",
        "[&_svg]:text-rf-text-2",
      )}
    >
      <Icon name={icon} size="sm" mirror={mirror} />
      {children}
    </button>
  );
}
