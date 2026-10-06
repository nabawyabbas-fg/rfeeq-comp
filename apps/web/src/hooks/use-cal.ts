/**
 * Props for the "contact us" affordances on the billing and usage surfaces.
 *
 * This was a Cal.com embed booking against `agentset/demo` — another product's
 * sales calendar — so the button sent our users to them. There is no Rfeeq
 * calendar to point it at, and keeping the embed would have meant loading a
 * third-party script to render a booking page for an account we do not own.
 * Email instead: it works today and needs no integration.
 *
 * The shape is unchanged so both call sites keep spreading it as before.
 */
const CONTACT_EMAIL = "support@rfeeq.ai";

export function useCal() {
  return {
    buttonProps: {
      onClick: () => {
        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
          "Rfeeq — plans and usage",
        )}`;
      },
    },
  };
}
