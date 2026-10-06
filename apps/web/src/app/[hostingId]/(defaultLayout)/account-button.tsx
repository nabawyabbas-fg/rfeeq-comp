"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogInIcon, LogOutIcon, UserIcon } from "lucide-react";

import { Button } from "@agentset/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@agentset/ui/dropdown-menu";

/**
 * Sign-in control for the hosted site.
 *
 * Visitors chat anonymously, identified only by a browser cookie — so their
 * history disappears on a new device, a cleared cookie, or a private window.
 * Signing in moves those conversations onto an account: the claim happens
 * server-side in resolveChatOwner the next time history is read or written.
 */
export function AccountButton({ baseUrl }: { baseUrl: string }) {
  // better-auth's own reactive hook rather than the shared useSession: that one
  // sets refetchOnMount:false with staleTime:Infinity, which relies on the
  // dashboard hydrating the session server-side. Nothing seeds that cache on a
  // hosted site, so the query there stays pending forever and this button never
  // resolves past its loading state.
  const { data: session, isPending } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // reserve the space so the header doesn't jump once the session resolves
  if (isPending) return <div className="h-9 w-20" />;

  if (!session?.user) {
    // Both routes are offered: an anonymous reader here has no account yet, and
    // a sign-in-only control gives them nowhere to go. `r` brings them back to
    // whatever page they were reading.
    const back = encodeURIComponent(pathname);
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${baseUrl}/login?r=${back}`}>
            <LogInIcon className="size-4" />
            Sign in
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`${baseUrl}/signup?r=${back}`}>Sign up</Link>
        </Button>
      </div>
    );
  }

  const label = session.user.email ?? session.user.name ?? "Account";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess() {
          router.refresh();
        },
      },
    });
    setIsSigningOut(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-40">
          <UserIcon className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isSigningOut} onClick={handleSignOut}>
          <LogOutIcon className="size-4" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
