/** Where a reader completes their account. */
export const PROFILE_PATH = "/login/profile";

/**
 * Whether the account-completion step has been answered.
 *
 * Consent is the field that decides it. A name arrives on its own from Google
 * or Apple and would make an untouched account look finished, and a birth year
 * is optional to give; acceptance of the terms is the one thing that can only
 * have come from the reader pressing the button.
 */
export const isProfileComplete = (user: { consentAt?: Date | string | null }) =>
  Boolean(user.consentAt);
