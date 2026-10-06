import type { Starter } from "@/lib/rfeeq/starters";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { ratelimit } from "@/lib/api/rate-limit";
import { CURATED, generateStarters } from "@/lib/rfeeq/starters";

/**
 * The opening screen's three suggestions.
 *
 * Cached across visitors rather than generated per load. The home screen is hit
 * on every visit and on every new chat, and these have no per-reader context to
 * be written from — so one generation serves everyone who arrives inside the
 * window, which keeps the chips arriving in a few milliseconds instead of a few
 * seconds. The reader sees the curated trio until then, and it is replaced
 * rather than waited for.
 *
 * The window is short enough that the suggestions change over a session's
 * lifetime and long enough that a busy minute is one model call.
 */
const TTL_MS = 10 * 60_000;

let cached: { at: number; starters: Starter[] } | null = null;
let inFlight: Promise<Starter[]> | null = null;

const fresh = () => cached !== null && Date.now() - cached.at < TTL_MS;

export const GET = async (req: Request) => {
  if (fresh()) return NextResponse.json({ starters: cached?.starters });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await ratelimit(20, "1 m").limit(`rfeeq-starters:${ip}`);
  // the curated set is a complete answer, so a throttled caller loses nothing
  // they can see
  if (!success) return NextResponse.json({ starters: CURATED });

  /*
   * One generation at a time. Without this, the first few visitors after the
   * window expires each start their own — the cheapest kind of stampede, but a
   * pointless one when they would all be handed the same three chips.
   */
  inFlight ??= generateStarters(env.OPENAI_API_KEY)
    .then((starters) => {
      cached = { at: Date.now(), starters };
      return starters;
    })
    .finally(() => {
      inFlight = null;
    });

  return NextResponse.json({ starters: await inFlight });
};
