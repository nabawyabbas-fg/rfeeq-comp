import type { NextRequest } from "next/server";
import { env } from "@/env";

export const INTERNAL_MIDDLEWARE_SECRET_HEADER = "x-agentset-middleware-secret";

export const getInternalMiddlewareHeaders = (req: NextRequest) => ({
  "Content-Type": "application/json",
  cookie: req.headers.get("cookie") ?? "",
  [INTERNAL_MIDDLEWARE_SECRET_HEADER]: env.BETTER_AUTH_SECRET ?? "",
  ...getForwardedHostHeaders(req),
});

/**
 * Loopback origin for the middleware's calls back into this same server.
 *
 * Not `req.nextUrl.origin`. That is the *public* origin, so behind a
 * TLS-terminating proxy these calls left the host, hairpinned through its own
 * public IP and re-entered through the proxy — a nested request inside the one
 * the proxy was already holding open. It failed two ways: a plain timeout
 * under load, and `ERR_SSL_PACKET_LENGTH_TOO_LONG` when the https origin was
 * used against a port that speaks plain HTTP. The middleware only ever needs to
 * reach its own server, so it addresses it directly and skips DNS, TLS and the
 * proxy entirely.
 */
const SELF_ORIGIN = `http://127.0.0.1:${process.env.PORT ?? 3000}`;

export const getInternalMiddlewareUrl = (_req: NextRequest, path: string) =>
  `${SELF_ORIGIN}${path}`;

/**
 * Headers that keep a loopback call presenting as the public request.
 *
 * The connection goes to 127.0.0.1, but anything deriving an origin from the
 * request — better-auth validating a session cookie, hosting resolving a custom
 * domain — must still see the host the browser asked for.
 */
export const getForwardedHostHeaders = (req: NextRequest) => {
  const host = req.headers.get("host") ?? "";
  return {
    host,
    "x-forwarded-host": req.headers.get("x-forwarded-host") ?? host,
    "x-forwarded-proto": req.headers.get("x-forwarded-proto") ?? "https",
  };
};
