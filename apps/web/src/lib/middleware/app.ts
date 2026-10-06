import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parse } from "@/lib/middleware/utils";
import { getSessionCookie } from "better-auth/cookies";

import { DASHBOARD_ENTRY, HOSTING_PREFIX, isRfeeqPath } from "../constants";
import { getMiddlewareSession } from "./get-session";
import HostingMiddleware from "./hosting";
import {
  getInternalMiddlewareHeaders,
  getInternalMiddlewareUrl,
} from "./internal-api";

const getDefaultOrganizationSlug = async (
  req: NextRequest,
  filter: {
    userId: string;
    activeOrganizationId: string | null;
  },
) => {
  const searchParams = new URLSearchParams({
    userId: filter.userId,
  });

  if (filter.activeOrganizationId) {
    searchParams.set("activeOrganizationId", filter.activeOrganizationId);
  }

  const response = await fetch(
    getInternalMiddlewareUrl(
      req,
      `/api/middleware/default-org?${searchParams.toString()}`,
    ),
    {
      headers: getInternalMiddlewareHeaders(req),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  try {
    const data = (await response.json()) as { slug: string | null };
    return data.slug;
  } catch {
    return null;
  }
};

/**
 * Routes the app origin between two products.
 *
 * `/` is the Rfeeq chat — open to guests, because the design gives an
 * unauthenticated visitor three questions before it asks them to sign in. The
 * dashboard it replaced still lives at `/{orgSlug}/...` and is reached through
 * `/admin`, which resolves the operator's default organisation the way `/` used
 * to. Consumer paths are passed through rather than rewritten, so they resolve
 * inside `app/(rfeeq)`; everything else keeps the old rewrite to
 * `app/app.agentset.ai`.
 */
export default async function AppMiddleware(
  req: NextRequest,
  event: NextFetchEvent,
) {
  const { path, fullPath } = parse(req);

  if (path.startsWith(HOSTING_PREFIX)) {
    return HostingMiddleware(req, event, "path");
  }

  const sessionCookie = getSessionCookie(req);

  if (isRfeeqPath(path)) {
    // one entry point: the design signs in and registers through the same OTP
    // screen, so /signup has nothing of its own to show
    if (path.startsWith("/signup")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    /*
     * A signed-in reader is *not* bounced off /login here. Where they go
     * depends on whether their profile is complete, which needs the database —
     * so the decision belongs to the page, and making it twice in two places
     * would be the kind of split that drifts.
     */
    return NextResponse.next();
  }

  // ----- dashboard -----

  // if the user is not logged in, and is trying to access a dashboard page,
  // send them to the Rfeeq sign-in — the only one this deployment has
  if (!sessionCookie && !path.startsWith("/invitation")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (sessionCookie && path === DASHBOARD_ENTRY) {
    const session = await getMiddlewareSession(req);
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const orgSlug = await getDefaultOrganizationSlug(req, {
      userId: session.user.id,
      activeOrganizationId: session.session.activeOrganizationId ?? null,
    });

    if (orgSlug) return NextResponse.redirect(new URL(`/${orgSlug}`, req.url));
    return NextResponse.redirect(new URL("/create-organization", req.url));
  }

  // otherwise, rewrite the path to /app
  return NextResponse.rewrite(new URL(`/app.agentset.ai${fullPath}`, req.url));
}
