import type { Transporter } from "nodemailer";
import type { CreateEmailOptions } from "resend";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { Resend } from "resend";

import { env } from "./env";

const APP_DOMAIN = env.APP_DOMAIN ?? "https://stg.rfeeq.ai";

interface SendEmailOptions extends Omit<CreateEmailOptions, "to" | "from"> {
  email: string;
  from?: string;
  variant?: "primary" | "notifications" | "marketing";
}

const VARIANT_TO_FROM_MAP = {
  primary: "Rfeeq <no-reply@rfeeq.ai>",
  notifications: "Rfeeq <notifications@rfeeq.ai>",
  marketing: "Rfeeq <hello@rfeeq.ai>",
};

/**
 * The sender for a variant.
 *
 * `EMAIL_FROM` overrides all of them when set, because a relay only accepts a
 * sender it holds a verified identity for, so a sender on an unverified
 * domain is rejected at MAIL FROM regardless of what the variant says.
 */
const fromFor = (variant: keyof typeof VARIANT_TO_FROM_MAP) =>
  env.EMAIL_FROM ?? VARIANT_TO_FROM_MAP[variant];

/** Built once and reused: each transport opens a pooled connection. */
let smtp: Transporter | null = null;
const smtpTransport = () => {
  if (smtp) return smtp;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "EMAIL_TRANSPORT=smtp requires SMTP_HOST, SMTP_USER and SMTP_PASS",
    );
  }
  smtp = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    // 587 is STARTTLS, not implicit TLS — `secure: true` would try to speak TLS
    // to a plaintext port and fail the handshake.
    secure: SMTP_PORT === 465,
    requireTLS: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return smtp;
};

export const sendEmail = async (opts: SendEmailOptions) => {
  const {
    email,
    from,
    variant = "primary",
    bcc,
    replyTo,
    subject,
    text,
    react,
    scheduledAt,
  } = opts;

  const sender = from || fromFor(variant);
  const listUnsubscribe =
    variant === "marketing"
      ? { "List-Unsubscribe": `${APP_DOMAIN}/account/settings` }
      : undefined;

  if (env.EMAIL_TRANSPORT === "smtp") {
    if (scheduledAt) {
      // Resend queues these server-side; SMTP has no equivalent, and sending a
      // scheduled message immediately would be a silent behaviour change.
      throw new Error("scheduledAt is not supported by the SMTP transport");
    }

    // Resend renders React Email components itself. Over SMTP that has to
    // happen here, and both bodies are produced so clients without HTML still
    // get readable text.
    const html = react ? await render(react) : undefined;
    const plain =
      text ?? (react ? await render(react, { plainText: true }) : undefined);

    return await smtpTransport().sendMail({
      to: email,
      from: sender,
      bcc: bcc as string | string[] | undefined,
      replyTo: replyTo || "support@rfeeq.ai",
      subject: subject!,
      text: plain,
      html,
      ...(listUnsubscribe ? { headers: listUnsubscribe } : {}),
    });
  }

  if (!env.RESEND_API_KEY) {
    throw new Error("EMAIL_TRANSPORT=resend requires RESEND_API_KEY");
  }
  const resend = new Resend(env.RESEND_API_KEY);

  return await resend.emails.send({
    to: email,
    from: sender,
    bcc: bcc,
    replyTo: replyTo || "support@rfeeq.ai",
    subject: subject!,
    text,
    react,
    scheduledAt,
    ...(listUnsubscribe ? { headers: listUnsubscribe } : {}),
  });
};
