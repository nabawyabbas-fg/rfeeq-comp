"use client";

import type { AnswerDepth } from "@/lib/rfeeq/answer-depth";
import type { Expertise } from "@/lib/rfeeq/expertise";
import { DEFAULT_ANSWER_DEPTH } from "@/lib/rfeeq/answer-depth";
import { DEFAULT_EXPERTISE } from "@/lib/rfeeq/expertise";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Reader-set text size. Drives `--rf-scale`, which the type tokens multiply. */
export type FontSize = "sm" | "md" | "lg";

const SCALE: Record<FontSize, string> = {
  sm: "0.92",
  md: "1",
  lg: "1.12",
};

export const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "sm", label: "صغير" },
  { value: "md", label: "متوسط" },
  { value: "lg", label: "كبير" },
];

interface PreferencesState {
  fontSize: FontSize;
  answerDepth: AnswerDepth;
  /**
   * Who is reading, which changes *which sources are read* — not how much is
   * said. Orthogonal to `answerDepth`, which is a length control.
   */
  expertise: Expertise;
  /** Whether the history rail is expanded. Collapsed leaves an icon rail. */
  sidebarOpen: boolean;
  setFontSize: (value: FontSize) => void;
  setAnswerDepth: (value: AnswerDepth) => void;
  setExpertise: (value: Expertise) => void;
  toggleSidebar: () => void;
}

/**
 * Reader preferences, kept in the browser.
 *
 * Not on the account, deliberately. These are display choices that belong to
 * the device being read on — a phone and a desktop want different text sizes —
 * and the brief's الخصوصية criterion argues against storing anything about the
 * reader server-side that does not have to be there.
 *
 * The theme is not here: next-themes already owns it, and two stores for one
 * setting is how they drift apart.
 *
 * Persisted through zustand rather than read from localStorage in an effect.
 * The effect version sets state on mount, which React flags as a cascading
 * render and which visibly snaps the rail shut a frame after paint; the
 * middleware rehydrates without a render pass of its own.
 */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      fontSize: "md",
      answerDepth: DEFAULT_ANSWER_DEPTH,
      expertise: DEFAULT_EXPERTISE,
      sidebarOpen: true,
      setFontSize: (fontSize) => set({ fontSize }),
      setAnswerDepth: (answerDepth) => set({ answerDepth }),
      setExpertise: (expertise) => set({ expertise }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    { name: "rfeeq:preferences" },
  ),
);

/**
 * Applies the text-size preference by setting one variable.
 *
 * `--rf-scale` multiplies every body and Qurʾānic size token, so one value
 * resizes the answer and the verse together — which is the point. Setting it on
 * the root rather than on a container means the panels and dialogs, which
 * portal out of the app tree, scale with everything else.
 */
export const applyFontSize = (size: FontSize) => {
  document.documentElement.style.setProperty("--rf-scale", SCALE[size]);
};
