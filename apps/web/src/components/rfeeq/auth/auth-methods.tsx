"use client";

import { useSocialProviders } from "@/contexts/rfeeq-context";
import { useAppleAuth, useGoogleAuth } from "@/hooks/use-auth";

import { AppleIcon } from "@agentset/ui/icons/apple";
import { GoogleIcon } from "@agentset/ui/icons/google";

import { Button } from "../ui/button";

/**
 * The three ways in, in the design's order: Google, Apple, then email.
 *
 * Email is the primary button despite being last. The two social options are
 * one tap where they apply, so they come first physically; the email route is
 * the one that always works, which is what primary emphasis is for.
 *
 * An unconfigured provider is omitted rather than disabled — better-auth only
 * registers a provider whose credentials are present and answers
 * PROVIDER_NOT_FOUND otherwise, which reads as a broken button.
 */
export function AuthMethods({
  onEmail,
  emailLabel = "المتابعة بالبريد الإلكتروني",
}: {
  onEmail: () => void;
  emailLabel?: string;
}) {
  const providers = useSocialProviders();
  const { googleLogin, isLoggingInWithGoogle } = useGoogleAuth();
  const { appleLogin, isLoggingInWithApple } = useAppleAuth();

  return (
    <div className="grid gap-3">
      {providers.google ? (
        <Button
          variant="secondary"
          block
          isLoading={isLoggingInWithGoogle}
          onClick={() => void googleLogin()}
        >
          <GoogleIcon className="size-5" />
          المتابعة بحساب Google
        </Button>
      ) : null}

      {providers.apple ? (
        <Button
          variant="apple"
          block
          isLoading={isLoggingInWithApple}
          onClick={() => void appleLogin()}
        >
          <AppleIcon className="size-5" />
          المتابعة بحساب Apple
        </Button>
      ) : null}

      <Button variant="primary" block onClick={onEmail}>
        {emailLabel}
      </Button>
    </div>
  );
}
