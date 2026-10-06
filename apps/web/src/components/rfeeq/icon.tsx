import { cn } from "@agentset/ui/cn";

import type { RfeeqIconName } from "./icon-sprite";

/** 16 / 20 / 24 — the only three sizes the design uses. */
export type IconSize = "sm" | "md" | "lg";

const SIZE: Record<IconSize, string> = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

/**
 * One icon from the sprite.
 *
 * `fill-none` and the stroke defaults are set here rather than relying on the
 * symbols: several paths in the set carry a `fill` attribute, and without an
 * explicit none they render as filled blobs at small sizes.
 *
 * `mirror` flips icons whose meaning is directional — a chevron, a back arrow.
 * Unconditional rather than behind Tailwind's `rtl:` variant because this
 * component only ever renders inside the RTL consumer app, and a conditional
 * would quietly do nothing if one of these screens were ever embedded LTR.
 */
export function Icon({
  name,
  size = "md",
  mirror,
  className,
}: {
  name: RfeeqIconName;
  size?: IconSize;
  mirror?: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn(
        "shrink-0 fill-none stroke-current",
        "[stroke-width:1.5] [stroke-linecap:round] [stroke-linejoin:round]",
        SIZE[size],
        mirror && "-scale-x-100",
        className,
      )}
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}
