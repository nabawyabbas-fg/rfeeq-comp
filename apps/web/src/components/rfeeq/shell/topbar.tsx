"use client";

import type { RfeeqViewer } from "@/contexts/rfeeq-context";
import { useTheme } from "next-themes";

import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";
import { RfeeqLogo } from "../logo";
import { Button, IconButton } from "../ui/button";
import { AccountMenu } from "./account-menu";

export function Topbar({
  viewer,
  onNewChat,
  onOpenHistory,
  onSignIn,
}: {
  viewer: RfeeqViewer | null;
  onNewChat: () => void;
  /** Narrow screens have no rail; the clock button opens history as a drawer. */
  onOpenHistory: () => void;
  onSignIn: () => void;
}) {
  return (
    <header
      className={cn(
        "flex min-h-13 shrink-0 items-center gap-2 bg-transparent px-3",
        // on a phone this is the only chrome, so it takes a surface and a rule
        // to separate itself from the thread scrolling under it
        "max-rf:border-b max-rf:border-rf-line max-rf:bg-rf-surface",
      )}
    >
      <IconButton
        className="rf:hidden"
        aria-label="سجل المحادثات"
        onClick={onOpenHistory}
      >
        <Icon name="clock" size="lg" />
      </IconButton>

      <RfeeqLogo className="rf:hidden w-15" />

      <IconButton
        className="rf:hidden"
        aria-label="محادثة جديدة"
        onClick={onNewChat}
      >
        <Icon name="edit" size="lg" />
      </IconButton>

      <span className="flex-1" />

      <ThemeToggle />

      {viewer ? (
        <AccountMenu viewer={viewer} />
      ) : (
        <Button size="sm" onClick={onSignIn}>
          تسجيل الدخول
        </Button>
      )}
    </header>
  );
}

/**
 * Light / dark, as one button.
 *
 * Nothing about this component is stateful, including the accessible name.
 * next-themes cannot know the resolved theme until it has mounted, so anything
 * derived from it in React renders the wrong way round on first paint and
 * corrects a frame later — a visible flip on every load. CSS already knows,
 * because the same class drives the palette, so both the icon and the label
 * are swapped by the `dark:` variant.
 *
 * The click reads the DOM for the same reason: `document.documentElement` is
 * authoritative from the first paint, while `resolvedTheme` is undefined until
 * mount, and a press in that window would set dark regardless of what was on
 * screen. Choosing here pins the theme; the way back to following the OS is the
 * three-way control in settings.
 */
function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <IconButton
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "light" : "dark");
      }}
    >
      <Icon name="moon" size="lg" className="dark:hidden" />
      <Icon name="sun" size="lg" className="hidden dark:block" />
      <span className="sr-only dark:hidden">التبديل إلى المظهر الداكن</span>
      <span className="sr-only hidden dark:inline">
        التبديل إلى المظهر الفاتح
      </span>
    </IconButton>
  );
}
