import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

import { env as emailsEnv } from "@agentset/emails/env";
import { env as engineEnv } from "@agentset/engine/env";
import { env as storageEnv } from "@agentset/storage/env";
import { env as stripeEnv } from "@agentset/stripe/env";

export const env = createEnv({
  extends: [engineEnv, storageEnv, stripeEnv, emailsEnv],
  shared: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXT_PUBLIC_APP_NAME: z.string().optional().default("Rfeeq"),
    NEXT_PUBLIC_APP_SHORT_DOMAIN: z.string().optional().default("rfeeq.ai"),
    NEXT_PUBLIC_APP_HOSTS: z.string().optional(),
    /**
     * Full origin the app is reached at, scheme included — e.g.
     * `https://stag.rfeeq.ai`. Needed because the origin is otherwise assembled
     * as `http://` + host, which is wrong behind a TLS-terminating proxy.
     */
    NEXT_PUBLIC_APP_ORIGIN: z.string().url().optional(),

    NEXT_PUBLIC_VERCEL_ENV: z
      .enum(["development", "preview", "production"])
      .optional()
      .default("development"),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  },
  server: {
    DATABASE_URL: z.url(),

    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.url(),

    /**
     * Social sign-in. Optional so a deployment without a provider's
     * credentials still boots — auth.ts omits any provider whose pair is
     * missing rather than registering a broken one.
     */

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_SECRET: z.string().optional(),
    APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),
    /** Organisation every new account is added to. Unset = each gets its own. */
    DEFAULT_ORGANIZATION_ID: z.string().optional(),

    /**
     * Which corpus the Rfeeq chat answers from.
     *
     * The consumer app has no namespace picker by design — the brief routes a
     * question to a corpus by its intent, not by asking the reader to choose —
     * so the surface needs one configured namespace. Optional, and resolution
     * falls back to the default organisation's only namespace, which is the
     * common case on this deployment. With neither, the app still renders and
     * says so rather than failing to boot.
     */
    RFEEQ_NAMESPACE_SLUG: z.string().optional(),

    REDIS_URL: z.url(),
    REDIS_TOKEN: z.string(),

    STRIPE_WEBHOOK_SECRET: z.string(),

    DISCORD_HOOK_ALERTS: z.url().optional(),
    DISCORD_HOOK_CRON: z.url().optional(),
    DISCORD_HOOK_SUBSCRIBERS: z.url().optional(),
    DISCORD_HOOK_ERRORS: z.url().optional(),

    TRIGGER_SECRET_KEY: z.string(),

    VERCEL_PROJECT_ID: z.string(),
    VERCEL_TEAM_ID: z.string(),
    VERCEL_API_TOKEN: z.string(),
  },
  client: {},
  runtimeEnv: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_SHORT_DOMAIN: process.env.NEXT_PUBLIC_APP_SHORT_DOMAIN,
    NEXT_PUBLIC_APP_HOSTS: process.env.NEXT_PUBLIC_APP_HOSTS,
    NEXT_PUBLIC_APP_ORIGIN: process.env.NEXT_PUBLIC_APP_ORIGIN,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,

    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,

    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
    APPLE_CLIENT_SECRET: process.env.APPLE_CLIENT_SECRET,
    APPLE_APP_BUNDLE_IDENTIFIER: process.env.APPLE_APP_BUNDLE_IDENTIFIER,
    DEFAULT_ORGANIZATION_ID: process.env.DEFAULT_ORGANIZATION_ID,
    RFEEQ_NAMESPACE_SLUG: process.env.RFEEQ_NAMESPACE_SLUG,

    REDIS_URL: process.env.REDIS_URL,
    REDIS_TOKEN: process.env.REDIS_TOKEN,

    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

    DISCORD_HOOK_ALERTS: process.env.DISCORD_HOOK_ALERTS,
    DISCORD_HOOK_CRON: process.env.DISCORD_HOOK_CRON,
    DISCORD_HOOK_SUBSCRIBERS: process.env.DISCORD_HOOK_SUBSCRIBERS,
    DISCORD_HOOK_ERRORS: process.env.DISCORD_HOOK_ERRORS,

    TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY,

    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
    VERCEL_API_TOKEN: process.env.VERCEL_API_TOKEN,
  },
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
