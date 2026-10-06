"use client";

import type { Starter } from "@/lib/rfeeq/starters";
import { useEffect, useState } from "react";
import { CURATED, MAX_STARTERS } from "@/lib/rfeeq/starters";

/**
 * Suggestions already fetched this session.
 *
 * Module-level, like the follow-ups' cache and for a sharper reason: the home
 * screen is mounted again on every new chat, and a reader who starts three
 * conversations should not watch the chips change under them each time. One set
 * per session reads as the app having a view; three sets read as churn.
 */
let cache: Starter[] | null = null;
let inFlight: Promise<void> | null = null;

/**
 * The three ways in.
 *
 * Returns the curated trio until a written set arrives, so the row is never
 * empty and never shifts — three chips are rendered from the first frame, and
 * only their text changes. If generation fails the curated set is simply what
 * stays, which is why it is a known-good trio rather than a placeholder.
 */
export function useStarters(): Starter[] {
  const [fetched, setFetched] = useState<Starter[] | null>(null);

  // read during render rather than copied in by an effect: the cache is
  // populated by an earlier mount, and mirroring it into state would be a
  // render pass that changes nothing a reader can see
  const starters = fetched ?? cache;

  useEffect(() => {
    if (cache) return;

    let cancelled = false;
    inFlight ??= fetch("/api/rfeeq-starters")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { starters?: Starter[] } | null) => {
        const next = data?.starters ?? [];
        if (next.length === MAX_STARTERS) cache = next;
      })
      .catch(() => {
        // leave the curated set in place
      })
      .finally(() => {
        inFlight = null;
      });

    void inFlight.then(() => {
      if (!cancelled && cache) setFetched(cache);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return starters ?? CURATED;
}
