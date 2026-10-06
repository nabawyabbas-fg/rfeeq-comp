"use client";

import type { SocialProviders } from "@/lib/social-providers";
import { useState } from "react";
import {
  useAppleAuth,
  useGoogleAuth,
  usePasswordSignUp,
} from "@/hooks/use-auth";
import { APP_NAME } from "@/lib/constants";
import { AlertCircleIcon } from "lucide-react";

import { Alert, AlertTitle } from "@agentset/ui/alert";
import { Button } from "@agentset/ui/button";
import { cn } from "@agentset/ui/cn";
import { AppleIcon } from "@agentset/ui/icons/apple";
import { GoogleIcon } from "@agentset/ui/icons/google";
import { Input } from "@agentset/ui/input";
import { Label } from "@agentset/ui/label";

/** Matches better-auth's `minPasswordLength` so the check fails client-side first. */
const MIN_PASSWORD = 12;

export function SignupForm({
  className,
  socialProviders,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  /** Resolved server-side; a provider without credentials is not rendered. */
  socialProviders: SocialProviders;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [local, setLocal] = useState<string | null>(null);

  const { signUp, isSigningUp, error } = usePasswordSignUp();
  const { googleLogin, isLoggingInWithGoogle } = useGoogleAuth();
  const { appleLogin, isLoggingInWithApple } = useAppleAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocal(null);
    if (password.length < MIN_PASSWORD) {
      // checked here as well as server-side: a rejected signup otherwise loses
      // the whole form to a generic error
      setLocal(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    await signUp({ name, email, password }).catch(() => {
      // surfaced through `error` from the hook
    });
  };

  const shown = local ?? error;

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-xl bg-white shadow-md ring-1 ring-black/5",
        className,
      )}
      {...props}
    >
      <div className="p-7 sm:p-11">
        <div className="flex items-start">
          <a href="/" title="Home">
            <span className="text-xl font-semibold tracking-tight">
              {APP_NAME}
            </span>
          </a>
        </div>

        <h1 className="mt-8 text-base/6 font-medium">Create your account</h1>
        <p className="mt-1 text-sm/5 text-gray-600">
          Already have one?{" "}
          <a
            href="/login"
            className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
          >
            Sign in
          </a>
        </p>

        {shown && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircleIcon className="size-4" />
            <AlertTitle>{shown}</AlertTitle>
          </Alert>
        )}

        <form onSubmit={submit}>
          <div className="mt-8 space-y-3">
            <Label className="text-sm/5 font-medium" htmlFor="name">
              Name
            </Label>
            <Input
              id="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Label className="text-sm/5 font-medium" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Label className="text-sm/5 font-medium" htmlFor="password">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              At least {MIN_PASSWORD} characters.
            </p>
          </div>

          <Button
            type="submit"
            className="mt-8 w-full"
            isLoading={isSigningUp}
            disabled={!name || !email || !password}
          >
            Create account
          </Button>
        </form>

        {/* an unconfigured provider is omitted by makeAuth, so a button for it
            would answer PROVIDER_NOT_FOUND — hidden rather than dead */}
        {(socialProviders.google || socialProviders.apple) && (
          <>
            <div className="relative mt-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or</span>
              </div>
            </div>

            <div
              className={cn(
                "mt-6 grid gap-4",
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
      </div>
    </div>
  );
}
