"use client";

import type { SocialProviders } from "@/lib/social-providers";
import { useState } from "react";
import {
  useAppleAuth,
  useGoogleAuth,
  useLoginError,
  useMagicAuth,
  useOtpAuth,
  usePasswordAuth,
} from "@/hooks/use-auth";
import { APP_NAME } from "@/lib/constants";
import { AlertCircleIcon, ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";

import { Alert, AlertTitle } from "@agentset/ui/alert";
import { Button } from "@agentset/ui/button";
import { cn } from "@agentset/ui/cn";
import { AppleIcon } from "@agentset/ui/icons/apple";
import { GoogleIcon } from "@agentset/ui/icons/google";
import { Input } from "@agentset/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@agentset/ui/input-otp";
import { Label } from "@agentset/ui/label";

type LoginMode = "magic" | "otp" | "password";

/**
 * Where "no account" goes. The public hosted corpus, not the dashboard — the
 * dashboard is organisation-scoped and an anonymous visitor has no org.
 */
const ANONYMOUS_ENTRY = "/a/turath-aqida";

export function LoginForm({
  className,
  redirectParam,
  socialProviders,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  redirectParam?: string;
  /** Resolved server-side; a provider without credentials is not rendered. */
  socialProviders: SocialProviders;
}) {
  const [mode, setMode] = useState<LoginMode>("magic");
  const {
    email,
    setEmail,
    sent,
    magicLogin,
    isSendingMagicLink,
    reset: resetMagic,
  } = useMagicAuth();
  const { googleLogin, isLoggingInWithGoogle } = useGoogleAuth();
  const { appleLogin, isLoggingInWithApple } = useAppleAuth();
  const {
    otp,
    setOtp,
    otpSent,
    error: otpError,
    sendOtp,
    isSendingOtp,
    verifyOtp,
    isVerifyingOtp,
    reset: resetOtp,
  } = useOtpAuth();
  const {
    password,
    setPassword,
    passwordLogin,
    isSigningIn,
    error: passwordError,
    reset: resetPassword,
  } = usePasswordAuth();
  const error = useLoginError();

  const handleMagicSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    magicLogin();
  };

  const handleOtpVerify = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    verifyOtp(email);
  };

  const switchToOtp = async () => {
    await sendOtp(email);
    resetMagic();
    setMode("otp");
  };

  const switchToMagic = () => {
    resetOtp();
    resetPassword();
    setMode("magic");
  };

  // Email delivery is not wired up on every deployment; a password is the only
  // sign-in that needs nothing to leave the box.
  const switchToPassword = () => {
    resetMagic();
    setMode("password");
  };

  const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void passwordLogin(email);
  };

  const displayError =
    mode === "otp" ? otpError : mode === "password" ? passwordError : error;
  const showError = displayError && !sent && !otpSent;

  return (
    <>
      {showError && (
        <Alert className="w-full max-w-md" variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{displayError}</AlertTitle>
        </Alert>
      )}

      <div
        className={cn(
          "w-full max-w-md rounded-xl bg-white shadow-md ring-1 ring-black/5",
          className,
        )}
        {...props}
      >
        {sent ? (
          <div className="flex flex-col items-center justify-center p-7 sm:p-11">
            <CheckCircle2Icon className="size-8" />
            <h1 className="mt-4 text-lg font-medium">Check your email</h1>
            <p className="mt-1 max-w-2xs text-center text-sm text-gray-600">
              We've sent a magic link to your email. Click the link to login.
            </p>
          </div>
        ) : mode === "password" ? (
          <div className="p-7 sm:p-11">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={switchToMagic}
                type="button"
                aria-label="Back to magic link"
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <a href="/" target="_blank" title="Home">
                <span className="text-xl font-semibold tracking-tight">
                  {APP_NAME}
                </span>
              </a>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <h1 className="mt-8 text-base/6 font-medium">
                Sign in with a password
              </h1>

              <div className="mt-8 space-y-3">
                <Label className="text-sm/5 font-medium" htmlFor="pw-email">
                  Email
                </Label>
                <Input
                  id="pw-email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="mt-6 space-y-3">
                <Label className="text-sm/5 font-medium" htmlFor="pw">
                  Password
                </Label>
                <Input
                  id="pw"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="mt-8">
                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isSigningIn}
                  disabled={!email || !password || isSigningIn}
                >
                  Sign in
                </Button>
              </div>
            </form>
          </div>
        ) : mode === "otp" ? (
          <div className="p-7 sm:p-11">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={switchToMagic}
                type="button"
                aria-label="Back to magic link"
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <a href="/" target="_blank" title="Home">
                <span className="text-xl font-semibold tracking-tight">
                  {APP_NAME}
                </span>
              </a>
            </div>

            {otpSent && (
              <form onSubmit={handleOtpVerify}>
                <h1 className="mt-8 text-base/6 font-medium">
                  Enter your code
                </h1>
                <p className="mt-1 text-sm/5 text-gray-600">
                  We sent a 6-digit code to {email}
                </p>

                <div className="mt-8 flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={setOtp}
                    onComplete={verifyOtp}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="mt-8">
                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={isVerifyingOtp}
                    disabled={otp.length !== 6 || isVerifyingOtp}
                  >
                    Verify code
                  </Button>
                </div>

                <div className="mt-4 text-center">
                  <Button
                    variant="link"
                    type="button"
                    onClick={() => sendOtp(email)}
                    isLoading={isSendingOtp}
                    className="text-sm text-gray-600"
                  >
                    Resend code
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="p-7 sm:p-11">
            <form onSubmit={handleMagicSubmit}>
              <div className="flex items-start">
                <a href="/" target="_blank" title="Home">
                  <span className="text-xl font-semibold tracking-tight">
                    {APP_NAME}
                  </span>
                </a>
              </div>
              <h1 className="mt-8 text-base/6 font-medium">Welcome back!</h1>

              <div className="mt-8 space-y-3">
                <Label className="text-sm/5 font-medium" htmlFor="email">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="mt-8">
                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isSendingMagicLink}
                >
                  Sign in
                </Button>
              </div>
            </form>

            {/* an unconfigured provider is omitted by makeAuth, so a button for
                it would answer PROVIDER_NOT_FOUND — hidden rather than dead */}
            {(socialProviders.google || socialProviders.apple) && (
              <>
                <div className="after:border-border relative my-4 text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                  <span className="bg-background text-muted-foreground relative z-10 px-2">
                    Or
                  </span>
                </div>

                <div
                  className={cn(
                    "grid gap-4",
                    socialProviders.google &&
                      socialProviders.apple &&
                      "sm:grid-cols-2",
                  )}
                >
                  {socialProviders.google && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => googleLogin()}
                      isLoading={isLoggingInWithGoogle}
                      type="button"
                    >
                      <GoogleIcon className="size-4" />
                      Google
                    </Button>
                  )}

                  {socialProviders.apple && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => appleLogin()}
                      isLoading={isLoggingInWithApple}
                      type="button"
                    >
                      <AppleIcon className="size-4" />
                      Apple
                    </Button>
                  )}
                </div>
              </>
            )}

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={switchToPassword}
                className="cursor-pointer text-sm font-medium text-gray-600 underline underline-offset-4 hover:text-black"
              >
                Sign in with a password
              </button>
            </div>
          </div>
        )}
      </div>

      {/*
       * Outside the mode switch on purpose. This lived inside the magic-link
       * branch, so choosing "password" or "login code" made the only route to an
       * account disappear. Hidden once a link has been sent, when the next step
       * is the mailbox rather than another choice.
       */}
      {!sent && (
        <p className="mt-4 text-center text-sm text-gray-600">
          No account?{" "}
          <a
            href="/signup"
            className="font-medium text-gray-800 underline underline-offset-4 hover:text-black"
          >
            Create one
          </a>{" "}
          or{" "}
          <a
            href={ANONYMOUS_ENTRY}
            className="font-medium text-gray-800 underline underline-offset-4 hover:text-black"
          >
            ask without an account
          </a>
        </p>
      )}

      {sent && (
        <p className="mt-4 text-center text-sm text-gray-600">
          Magic link not working?{" "}
          <button
            type="button"
            onClick={switchToOtp}
            className="cursor-pointer font-medium text-gray-800 underline underline-offset-4 hover:text-black"
          >
            Use a login code instead
          </button>
        </p>
      )}
    </>
  );
}
