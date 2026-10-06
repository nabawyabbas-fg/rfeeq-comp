import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

import { cn } from "@agentset/ui/cn";

import type { RfeeqIconName } from "../icon-sprite";
import { Icon } from "../icon";

/**
 * `.chip` — a selectable or tappable pill.
 *
 * `aria-pressed` carries the selected state rather than a class, so the styling
 * cannot drift from what a screen reader is told.
 */
const chip = cva(
  [
    "inline-flex min-h-9 cursor-pointer items-center gap-2 px-3 text-start",
    "font-rf-ui rounded-full border-[1.5px] text-sm/[1.4] font-medium",
    "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
    "aria-pressed:border-rf-accent aria-pressed:bg-rf-accent-soft aria-pressed:text-rf-accent",
    "[&_svg]:text-rf-accent",
  ],
  {
    variants: {
      variant: {
        default:
          "border-rf-line bg-rf-surface text-rf-text hover:border-rf-line-strong",
        /* «متابعة» chips: outlined in accent at rest, since they invite an
           action rather than report a state */
        follow:
          "border-rf-accent text-rf-accent hover:bg-rf-accent-soft bg-transparent",
        /* a suggested question — a full-width block that wraps, not a pill */
        prompt:
          "rounded-rf-md border-rf-line-strong text-rf-text hover:border-rf-accent hover:text-rf-accent justify-start bg-transparent py-2 whitespace-normal",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Chip({
  className,
  variant,
  icon,
  children,
  type = "button",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof chip> & { icon?: RfeeqIconName }) {
  return (
    <button type={type} className={cn(chip({ variant }), className)} {...props}>
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </button>
  );
}

/**
 * `.badge` — what kind of answer this is, which domain it came from, and
 * whether it was retrieved or searched live.
 *
 * Three variants with three different borders on purpose: the template name is
 * filled, the domain is outlined, the engine is a flat grey. They appear in a
 * row above an answer, and a reader needs to tell at a glance which of the
 * three they are reading.
 */
const badge = cva(
  "font-rf-ui inline-flex h-6 items-center gap-1 rounded-full px-[9px] text-xs/none font-semibold whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        template: "bg-rf-accent-soft text-rf-accent",
        domain: "border-rf-line-strong text-rf-text-2 border",
        engine: "bg-rf-surface-2 text-rf-text-2",
      },
    },
    defaultVariants: { variant: "template" },
  },
);

export function Badge({
  className,
  variant,
  icon,
  children,
}: VariantProps<typeof badge> & {
  className?: string;
  icon?: RfeeqIconName;
  children: React.ReactNode;
}) {
  return (
    <span className={cn(badge({ variant }), className)}>
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </span>
  );
}

/**
 * `.trust-tag` — marks a slot whose provenance is complete, or flags one whose
 * is not.
 *
 * Its own amber, outside the accent scale: a source attribution is not the same
 * claim as "this is the answer", and the brief's الموثوقية والإسناد criterion is
 * the one a reader most needs to be able to find without reading.
 */
export function TrustTag({
  label = "مصدر موثّق",
  incomplete,
  className,
}: {
  label?: string;
  /** Renders the «غير مكتملة» form: same amber, warning icon. */
  incomplete?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2",
        "bg-rf-trust-soft font-rf-ui text-rf-trust text-xs/none font-semibold",
        "[&_svg]:size-3.5",
        className,
      )}
    >
      <Icon name={incomplete ? "alert" : "shield"} size="sm" />
      {incomplete ? "غير مكتملة" : label}
    </span>
  );
}
