import { cn } from "@agentset/ui/cn";

import type { RfeeqIconName } from "../icon-sprite";
import { Icon } from "../icon";

/**
 * `.state` — an empty, error or not-found placeholder.
 *
 * Centred and narrow (32ch): these appear inside the history list and the
 * source panel, both of which are columns, and a full-width line of Arabic in a
 * 272px rail is unreadable.
 */
export function State({
  icon,
  title,
  description,
  tone = "neutral",
  action,
  className,
}: {
  icon: RfeeqIconName;
  title: string;
  description?: string;
  tone?: "neutral" | "error";
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      {...(tone === "error" ? { role: "alert" } : {})}
      className={cn(
        "grid justify-items-center gap-3 px-5 py-8 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "grid size-14 place-items-center rounded-full",
          tone === "error"
            ? "bg-rf-danger-soft text-rf-danger"
            : "bg-rf-surface-2 text-rf-text-2",
        )}
      >
        <Icon name={icon} size="lg" />
      </div>
      <h4 className="font-rf-ui text-rf-h3 text-rf-text font-semibold">
        {title}
      </h4>
      {description ? (
        <p className="font-rf-ui text-rf-body-sm text-rf-text-2 max-w-[32ch]">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}

/**
 * `.sk` — a shimmering bar standing in for a line of text.
 *
 * Sized by caller, because the loading answer uses three bars of descending
 * width to suggest a paragraph rather than a block.
 */
export function Skeleton({
  className,
  width,
}: {
  className?: string;
  width?: string;
}) {
  return (
    <div
      aria-hidden="true"
      style={width ? { width } : undefined}
      className={cn(
        "motion-safe:animate-rf-shimmer h-3 rounded-[7px] bg-[length:200%_100%]",
        "bg-[linear-gradient(90deg,var(--rf-surface-2),var(--rf-line),var(--rf-surface-2))]",
        className,
      )}
    />
  );
}

/** `.dots` — three accent dots, used while the search is still running. */
export function Dots({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex items-center gap-[5px]", className)}
    >
      <i className="bg-rf-accent motion-safe:animate-rf-pulse size-[7px] rounded-full" />
      <i className="bg-rf-accent motion-safe:animate-rf-pulse size-[7px] rounded-full [animation-delay:0.15s]" />
      <i className="bg-rf-accent motion-safe:animate-rf-pulse size-[7px] rounded-full [animation-delay:0.3s]" />
    </span>
  );
}

/** `.banner` — one line of status with an action pushed to the end. */
export function Banner({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-rf-md border-rf-line-strong flex items-center gap-3 border-[1.5px]",
        "bg-rf-surface-2 font-rf-ui text-rf-text px-4 py-3 text-sm/[1.6] font-medium",
        className,
      )}
    >
      {children}
      {action ? <div className="ms-auto">{action}</div> : null}
    </div>
  );
}

/** `.card` — the settings surface. A hairline border, not a shadow. */
export function Card({
  className,
  warn,
  children,
}: {
  className?: string;
  /** The destructive card: delete-my-data, sign out everywhere. */
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-rf-lg grid gap-3 border p-5",
        warn
          ? "border-rf-danger bg-rf-danger-soft"
          : "border-rf-line bg-rf-surface",
        "[&_h3]:font-rf-ui [&_h3]:text-rf-h3 [&_h3]:text-rf-text [&_h3]:font-semibold",
        warn ? "[&_p]:text-rf-text" : "[&_p]:text-rf-text-2",
        "[&_p]:font-rf-ui [&_p]:text-rf-body-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * `.seg` — a segmented control, used for the theme and font-size preferences.
 *
 * `aria-pressed` on each option rather than a radiogroup: these apply
 * immediately, so they are buttons that report a state, not a pending choice.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  wide,
  className,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  /** Fills its container and splits evenly — the settings form. */
  wide?: boolean;
  className?: string;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "border-rf-line-strong bg-rf-surface rounded-full border-[1.5px] p-0.5",
        wide ? "flex w-full" : "inline-flex",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-9 min-w-14 cursor-pointer rounded-full border-0 bg-transparent px-3",
            "font-rf-ui text-rf-text-2 text-[13px] font-semibold",
            "aria-pressed:bg-rf-accent aria-pressed:text-rf-on-accent",
            "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
            wide && "flex-1",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
