import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    /**
     * Which transport actually sends. Resend is the default deliberately: the
     * magic-link sign-in depends on mail working, so a misconfigured SMTP relay
     * must not be able to lock everyone out. Switching is one variable.
     */
    EMAIL_TRANSPORT: z.enum(["resend", "smtp"]).optional().default("resend"),

    /**
     * Optional. Required only when EMAIL_TRANSPORT is "resend" — checked where
     * it is used rather than here, so an SMTP-only deployment does not need to
     * carry a Resend key it will never call.
     */
    RESEND_API_KEY: z.string().min(1).optional(),

    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),

    /**
     * Overrides every `variant` sender when set, e.g.
     * `Rfeeq <no-reply@rfeeq.ai>`.
     *
     * A relay will only accept a sender it holds an identity for, so the
     * per-variant addresses below cannot be used unless their domain is
     * verified with the relay. One
     * override for all variants keeps the From valid no matter which variant a
     * caller asks for.
     */
    EMAIL_FROM: z.string().min(1).optional(),

    APP_DOMAIN: z.url().optional(),
  },
  runtimeEnv: {
    EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    APP_DOMAIN: process.env.APP_DOMAIN,
  },
  emptyStringAsUndefined: true,
});
