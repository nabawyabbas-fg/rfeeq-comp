"use client";

import type { RfeeqCorpus } from "@/lib/rfeeq/corpus";
import { createContext, use } from "react";

/** Who is reading. Null for a guest, which is a supported state, not an error. */
export interface RfeeqViewer {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface RfeeqConfig {
  /** Null until a corpus is ingested and given a hosting row. */
  corpus: RfeeqCorpus | null;
  viewer: RfeeqViewer | null;
  /**
   * Which social sign-ins are usable, resolved server-side.
   *
   * Carried in context because the sign-in choice appears in three places —
   * the guest wall, the sign-in prompt and the sign-in screen — and a button
   * for an unconfigured provider is a dead control in all three.
   */
  socialProviders: { google: boolean; apple: boolean };
}

const RfeeqContext = createContext<RfeeqConfig | null>(null);

export function RfeeqProvider({
  children,
  config,
}: {
  children: React.ReactNode;
  config: RfeeqConfig;
}) {
  return <RfeeqContext value={config}>{children}</RfeeqContext>;
}

export function useRfeeq() {
  const config = use(RfeeqContext);
  if (!config) throw new Error("useRfeeq used outside the Rfeeq app");
  return config;
}

export function useViewer() {
  return useRfeeq().viewer;
}

/**
 * Whether the reader is signed in.
 *
 * Phrased as `isGuest` rather than `!viewer` at each call site because guest is
 * a first-class mode here: the design gives a guest a working chat and asks for
 * an account only when something needs to persist.
 */
export function useIsGuest() {
  return useRfeeq().viewer === null;
}

/** The corpus, or null when none is configured. */
export function useCorpus() {
  return useRfeeq().corpus;
}

export function useSocialProviders() {
  return useRfeeq().socialProviders;
}

/**
 * How many questions a guest may ask in one session before the sign-in wall.
 *
 * Three, from the prototype. Enforced client-side only: it exists to prompt an
 * account at a natural moment, not to meter retrieval — the endpoint's own
 * per-IP rate limit does that.
 */
export const GUEST_QUESTION_LIMIT = 3;
