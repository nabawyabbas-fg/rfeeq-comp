import type { NextRequest } from "next/server";

import type { Session } from "../auth-types";
import {
  getForwardedHostHeaders,
  getInternalMiddlewareUrl,
} from "./internal-api";

export const getMiddlewareSession = async (req: NextRequest) => {
  // loopback, via the shared helper — see getInternalMiddlewareUrl
  const url = getInternalMiddlewareUrl(req, "/api/auth/get-session");

  const response = await fetch(url, {
    headers: {
      cookie: req.headers.get("cookie") ?? "",
      "Content-Type": "application/json",
      // The request is addressed to loopback but must still present as the
      // public host: better-auth derives the session's origin from these, and
      // a Host of 127.0.0.1 would not match the cookie it is validating.
      ...getForwardedHostHeaders(req),
    },
  });

  if (!response.ok) {
    return null;
  }

  try {
    const data = (await response.json()) as Session | null;
    return data;
  } catch {
    return null;
  }
};
