import "server-only";

import { env } from "@/env";

/**
 * Which social sign-in providers are actually usable.
 *
 * Derived from the same credentials `makeAuth` checks when registering
 * providers, so the buttons and the auth config cannot disagree. A provider
 * without credentials is omitted server-side and better-auth answers
 * `PROVIDER_NOT_FOUND` — a visible button for it is a dead control, which reads
 * as a broken app rather than an unconfigured one.
 *
 * Server-only: these are secrets, and the page passes the resolved list down to
 * the client form rather than exposing them.
 */
export const configuredSocialProviders = () =>
  ({
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET),
  }) satisfies Record<string, boolean>;

export type SocialProviders = ReturnType<typeof configuredSocialProviders>;
