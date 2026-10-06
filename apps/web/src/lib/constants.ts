import { env } from "@/env";

export const APP_NAME = env.NEXT_PUBLIC_APP_NAME;
export const SHORT_DOMAIN = env.NEXT_PUBLIC_APP_SHORT_DOMAIN;

const localHost = `localhost:${process.env.PORT ?? 3000}`;

/**
 * Additional `host:port` values to serve the app on, comma-separated. Needed when
 * developing on a remote machine: the browser sends an IP or hostname instead of
 * localhost, so the request would otherwise fall through to the custom-domain
 * (hosting) middleware and render not-found.
 */
const extraAppHosts = (env.NEXT_PUBLIC_APP_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const primaryHost = extraAppHosts[0] ?? localHost;

export const APP_HOSTNAMES = new Set([
  `app.${SHORT_DOMAIN}`,
  `staging.${SHORT_DOMAIN}`,
  localHost,
  ...extraAppHosts,
]);

/**
 * The origin the app is served at.
 *
 * `NEXT_PUBLIC_APP_ORIGIN` wins when set, because the fallback assembles the
 * origin as `http://` + host and there is no way to infer the scheme from a
 * host alone. Behind a TLS-terminating proxy that fallback yields an `http://`
 * origin for a site served over HTTPS — which would put a plain-http
 * `metadataBase`, invite links and auth cookie domain on a secure page.
 */
export const APP_DOMAIN =
  env.NEXT_PUBLIC_APP_ORIGIN ??
  (env.NEXT_PUBLIC_VERCEL_ENV === "production"
    ? `https://app.${SHORT_DOMAIN}`
    : env.NEXT_PUBLIC_VERCEL_ENV === "preview"
      ? `https://staging.${SHORT_DOMAIN}`
      : `http://${primaryHost}`);

export const API_HOSTNAMES = new Set([
  `api.${SHORT_DOMAIN}`,
  `api-staging.${SHORT_DOMAIN}`,
  `api.${localHost}`,
  ...extraAppHosts.map((host) => `api.${host}`),
]);

export const API_DOMAIN =
  env.NEXT_PUBLIC_VERCEL_ENV === "production"
    ? `https://api.${SHORT_DOMAIN}`
    : env.NEXT_PUBLIC_VERCEL_ENV === "preview"
      ? `https://api-staging.${SHORT_DOMAIN}`
      : `http://api.${primaryHost}`;

// for hosting
export const HOSTING_PREFIX = "/a/";

/**
 * First path segments the Rfeeq consumer app owns on the app origin.
 *
 * The dashboard lives at `/{orgSlug}/...`, so these names are reserved: an
 * organisation slugged "settings" would otherwise shadow the settings screen
 * (or, depending on resolution order, be shadowed by it). Checked as a set of
 * first segments rather than prefixes so `/settings-of-mine` stays a dashboard
 * path, as its slug implies.
 */
const RFEEQ_SEGMENTS = new Set([
  "", // the chat itself
  "c", // a saved conversation
  "login",
  "signup",
  "settings",
  "about",
  "s", // a shared answer, read-only
]);

/** Where a signed-in operator reaches the dashboard, now that `/` is the chat. */
export const DASHBOARD_ENTRY = "/admin";

export const isRfeeqPath = (path: string) => {
  const segment = path.split("/")[1] ?? "";
  return RFEEQ_SEGMENTS.has(segment);
};
