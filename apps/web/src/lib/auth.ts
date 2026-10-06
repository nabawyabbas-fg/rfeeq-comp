import { cache } from "react";
import { headers } from "next/headers";
import { after } from "next/server";
import { createApiKey } from "@/services/api-key/create";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, emailOTP, magicLink, organization } from "better-auth/plugins";
import { nanoid } from "nanoid";

import { db } from "@agentset/db/client";
import {
  InviteUserEmail,
  LoginEmail,
  OTPEmail,
  sendEmail,
  VerifyEmail,
  WelcomeEmail,
} from "@agentset/emails";
import { toSlug } from "@agentset/utils";

import { env } from "../env";
import { APP_DOMAIN, APP_NAME } from "./constants";
import { getBaseUrl } from "./utils";

export const makeAuth = (params?: { baseUrl: string; isHosting: boolean }) => {
  const isUsingDefaultUrl = params?.baseUrl === env.BETTER_AUTH_URL;

  return betterAuth({
    appName: "Rfeeq",
    database: prismaAdapter(db, {
      provider: "postgresql",
    }),
    advanced: {
      // Secure cookies require HTTPS, so browsers drop them when developing
      // against a plain-http origin (e.g. a remote box reached by IP).
      useSecureCookies: env.NODE_ENV === "production",
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14, // 14 days
    },
    emailAndPassword: {
      enabled: true,
      /*
       * Signup is open, so an address has to be proven before the account is
       * usable — otherwise anyone can register on an address they do not own.
       *
       * Safe to require only because the verification mail below is actually
       * wired: with this true and no sendVerificationEmail handler, a new user
       * can never sign in and has no way to ask for another link.
       */
      requireEmailVerification: true,
      minPasswordLength: 12,
    },
    emailVerification: {
      // sent by the signup itself, so the user is never left wondering whether
      // to go and request one
      sendOnSignUp: true,
      // they clicked the link in their own mailbox; making them type the
      // password again proves nothing further
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          email: user.email,
          subject: `Confirm your email for ${APP_NAME}`,
          react: VerifyEmail({
            verifyLink: url,
            email: user.email,
            domain: APP_DOMAIN,
          }),
        });
      },
    },
    ...(params
      ? {
          baseURL: params.baseUrl,
          trustedOrigins: [params.baseUrl],
        }
      : {}),
    secret: env.BETTER_AUTH_SECRET,
    /**
     * Only providers whose credentials are present are registered. Better-auth
     * will happily accept a provider with undefined credentials and then fail at
     * the redirect, which looks like a broken button rather than a missing
     * configuration — so an unconfigured provider is omitted instead.
     */
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
        ? {
            apple: {
              clientId: env.APPLE_CLIENT_ID,
              // Not a static secret: Apple requires a JWT signed with the .p8
              // key, valid at most six months, so this needs rotating.
              clientSecret: env.APPLE_CLIENT_SECRET,
              ...(env.APPLE_APP_BUNDLE_IDENTIFIER
                ? { appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER }
                : {}),
            },
          }
        : {}),
    },
    plugins: [
      admin(),
      organization({
        organizationHooks: {
          async afterCreateOrganization(data) {
            // create default api key
            await createApiKey({
              organizationId: data.organization.id,
              label: "Default API Key",
              scope: "all",
            });
          },
        },
        sendInvitationEmail: async ({ email, organization, id, inviter }) => {
          const url = `${getBaseUrl()}/invitation/${id}`;
          await sendEmail({
            email,
            subject: "You've been invited to join an organization on Rfeeq",
            react: InviteUserEmail({
              email,
              url,
              organizationName: organization.name,
              organizationUserEmail: inviter.user.email,
              organizationUser: inviter.user.name || null,
              domain: APP_DOMAIN,
            }),
          });
        },
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendEmail({
            email,
            subject: "Your Rfeeq login link",
            react: LoginEmail({ loginLink: url, email, domain: APP_DOMAIN }),
          });
        },
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          // Send the OTP for sign in
          if (type === "sign-in") {
            await sendEmail({
              email,
              subject: "Your Rfeeq login code",
              react: OTPEmail({ code: otp, email }),
            });
          }
        },
      }),
    ],
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "apple"],
        allowDifferentEmails: false,
      },
    },
    user: {
      /*
       * Account deletion, which the privacy screen offers.
       *
       * Enabled without an extra confirmation email: the caller is already
       * holding a live session, the UI requires an explicit acknowledgement
       * before the button becomes usable, and a second round trip through a
       * mailbox is friction that protects nothing a session does not already.
       * Chats cascade from the user row, so deleting the account deletes the
       * history with it — which is what the screen says it does.
       */
      deleteUser: { enabled: true },
      additionalFields: {
        referrerDomain: {
          type: "string",
          required: false,
        },
        /*
         * Collected by the Rfeeq account-completion step, not at sign-up: the
         * reader signs in with a code and nothing else, and is asked for these
         * once, afterwards. Declared here so the session carries them and the
         * completion step can tell a finished profile from an unfinished one.
         */
        birthYear: {
          type: "number",
          required: false,
          input: true,
        },
        consentAt: {
          type: "date",
          required: false,
          input: true,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // TODO: track the hosting id
          before:
            !isUsingDefaultUrl && params
              ? // eslint-disable-next-line @typescript-eslint/require-await
                async (user) => {
                  const domain = new URL(params.baseUrl).host;

                  return {
                    data: {
                      ...user,
                      referrerDomain: domain,
                    },
                  };
                }
              : undefined,
          after: async (user) => {
            // only send welcome email if using default url
            if (isUsingDefaultUrl && !params.isHosting) {
              after(async () => {
                await sendEmail({
                  email: user.email,
                  subject: "Welcome to Rfeeq",
                  react: WelcomeEmail({
                    name: user.name || null,
                    email: user.email,
                    domain: APP_DOMAIN,
                  }),
                  variant: "marketing",
                });
              });
            }

            /*
             * Where a new account lands.
             *
             * With DEFAULT_ORGANIZATION_ID set, everyone joins that one
             * organisation and immediately sees its namespaces. Without it the
             * original behaviour stands: a private organisation per user, which
             * on this deployment meant a new signup reached a dashboard with no
             * corpora in it at all.
             *
             * The membership row is written directly rather than through the
             * organization plugin: joining an existing organisation is not the
             * same operation as creating one, and createOrganization would run
             * afterCreateOrganization (minting another API key) as a side effect.
             */
            if (env.DEFAULT_ORGANIZATION_ID) {
              const org = await db.organization.findUnique({
                where: { id: env.DEFAULT_ORGANIZATION_ID },
                select: { id: true },
              });
              if (org) {
                await db.member.create({
                  data: {
                    // the member model has no id/createdAt default, so both are
                    // supplied here rather than left to the database
                    id: nanoid(24),
                    organizationId: org.id,
                    userId: user.id,
                    role: "member",
                    createdAt: new Date(),
                  },
                });
                return;
              }
              // fall through when the configured org no longer exists, so a
              // stale id cannot leave a new user with no organisation at all
            }

            await auth.api.createOrganization({
              body: {
                userId: user.id,
                name: `${user.name ? `${user.name}'s` : "First"} Organization`,
                slug: toSlug(user.name || "org", nanoid(9)),
              },
            });
          },
        },
      },
      session: {
        create: {
          async before(session) {
            // get the newest org for the user
            const org = await db.organization.findFirst({
              where: {
                members: {
                  some: { userId: session.userId },
                },
              },
              select: { id: true },
              orderBy: {
                createdAt: "desc",
              },
            });

            return {
              data: {
                ...session,
                activeOrganizationId: org?.id,
              },
            };
          },
        },
      },
    },
  });
};

export const auth = makeAuth();

export const getSession = cache(async (headersObj?: Headers) => {
  const session = await auth.api
    .getSession({
      headers: headersObj ?? (await headers()),
    })
    .catch(() => null);

  return session;
});
