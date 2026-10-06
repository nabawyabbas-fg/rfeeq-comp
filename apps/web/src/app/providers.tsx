"use client";

import { TRPCReactProvider } from "@/trpc/react";
import { ProgressProvider } from "@bprogress/next/app";

import { Toaster } from "@agentset/ui/sonner";
import { ThemeProvider } from "@agentset/ui/theme-provider";
import { TooltipProvider } from "@agentset/ui/tooltip";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    /*
     * Two attributes, three states.
     *
     * `class` is what Tailwind's `dark:` variant keys off and what the
     * dashboard's shadcn tokens already use; `data-theme` is what the Rfeeq
     * token blocks key off. Writing both keeps one switch driving both
     * surfaces instead of two theme systems disagreeing.
     *
     * System is enabled because the Rfeeq design specifies a system default —
     * next-themes stamps the *resolved* value, so an OS-dark visitor gets
     * `data-theme="dark"` with no explicit choice stored. The dashboard, which
     * used to be pinned light, now follows the OS too; its dark palette was
     * already defined, so this surfaces it rather than inventing it.
     */
    <ThemeProvider
      attribute={["class", "data-theme"]}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ProgressProvider
        height="4px"
        color="var(--primary)"
        options={{ showSpinner: false }}
        shallowRouting
      >
        <TRPCReactProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </TRPCReactProvider>
      </ProgressProvider>

      <Toaster />
    </ThemeProvider>
  );
}
