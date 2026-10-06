import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

import { cn } from "@agentset/ui/cn";

/**
 * The Rfeeq button, transcribed from the prototype's `.btn`.
 *
 * Not built on `@agentset/ui/button`: that one is shadcn's, sized in rem off a
 * 36px row and coloured from `--primary`. Rfeeq's rows are 40px with a 1.5px
 * border on every variant so a tonal and a secondary button line up to the
 * pixel, and its colours come from the `--rf-*` scale. Reconciling the two
 * would have meant overriding most of shadcn's base anyway.
 */
const button = cva(
  [
    "inline-flex cursor-pointer items-center justify-center gap-2 text-center",
    "rounded-rf-sm border-[1.5px] border-transparent bg-transparent",
    "font-rf-ui font-semibold no-underline",
    "transition-[background-color,border-color,color] duration-150",
    // the global 3px focus ring: buttons kept it when v1.2 took it off fields
    "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
    "disabled:bg-rf-surface-2 disabled:text-rf-text-3 disabled:cursor-not-allowed disabled:border-transparent",
    "aria-disabled:bg-rf-surface-2 aria-disabled:text-rf-text-3 aria-disabled:cursor-not-allowed aria-disabled:border-transparent",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-rf-accent text-rf-on-accent hover:not-disabled:bg-rf-accent-strong",
        secondary:
          "border-rf-line-strong bg-rf-surface text-rf-text hover:not-disabled:bg-rf-surface-2",
        tonal:
          "bg-rf-accent-soft text-rf-accent hover:not-disabled:border-rf-accent",
        ghost: "text-rf-accent hover:not-disabled:bg-rf-accent-soft",
        danger: "bg-rf-danger text-rf-on-danger",
        /* Apple's mark must sit on near-black in light and near-white in dark,
           which is the one place the palette inverts rather than shifts. */
        apple: "bg-rf-apple-bg text-rf-apple-fg",
      },
      size: {
        md: "min-h-10 px-5 text-[15px]/[1.4]",
        sm: "min-h-8 px-3 text-[13px]/[1.4]",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type RfeeqButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof button> & {
    /** Replaces the leading content with a spinner and disables the button. */
    isLoading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  block,
  isLoading,
  disabled,
  children,
  type = "button",
  ...props
}: RfeeqButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? isLoading}
      className={cn(button({ variant, size, block }), className)}
      {...props}
    >
      {isLoading ? <Spinner /> : null}
      {children}
    </button>
  );
}

/** `.spin` — a ring with one side cut away, so the gap reads as rotation. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-[18px] shrink-0 rounded-full border-[2.5px] border-current",
        "motion-safe:animate-rf-spin border-e-transparent",
        className,
      )}
    />
  );
}

/**
 * `.icon-btn` — a 36px round hit area for an icon alone.
 *
 * Transparent until hovered: these sit in the top bar and beside history rows,
 * where a resting background would compete with the row itself.
 */
export function IconButton({
  className,
  type = "button",
  children,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(
        "inline-grid size-9 shrink-0 cursor-pointer place-items-center rounded-full",
        "text-rf-text-2 border-0 bg-transparent",
        "hover:bg-rf-surface-2 hover:text-rf-text",
        "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
        "disabled:text-rf-text-3 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
