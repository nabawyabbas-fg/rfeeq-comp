import { cn } from "@agentset/ui/cn";

import { Icon } from "../icon";

/**
 * `.field` — label, control, and whatever the control has to say about itself.
 *
 * `invalid` is a property of the field rather than the input so the label and
 * the message participate: in the prototype `.field.err` reddens the border of
 * whichever control it contains, which is how one flag covers an input, a
 * select and a checkbox without three separate error styles.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  ok,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  ok?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-invalid={error ? "" : undefined}
      className={cn("grid gap-2", className)}
    >
      {label ? (
        <label
          htmlFor={htmlFor}
          className="font-rf-ui text-rf-label text-rf-text font-semibold"
        >
          {label}
        </label>
      ) : null}
      {children}
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {ok ? <OkMessage>{ok}</OkMessage> : null}
      {hint && !error ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

/*
 * Shared control chrome. v1.2 replaced the focus ring on text controls with a
 * plain border darkening — deliberately quieter than the 3px ring buttons keep,
 * because a form here is usually one field and the ring read as an error.
 */
const control = [
  "w-full border-[1.5px] border-rf-line-strong bg-rf-surface text-rf-text",
  "font-rf-ui placeholder:text-rf-text-3",
  "outline-none focus-visible:border-rf-text-2",
  "disabled:border-rf-line disabled:bg-rf-surface-2 disabled:text-rf-text-3",
  // the field marks itself invalid; the control inherits it from the ancestor,
  // which is what lets one flag redden an input, a select or a checkbox
  "[[data-invalid]_&]:border-rf-danger",
  "[[data-invalid]_&]:focus-visible:border-rf-danger",
];

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        control,
        "rounded-rf-sm h-11 min-h-11 px-3 text-[15px]",
        className,
      )}
      {...props}
    />
  );
}

/** An email address is LTR text in an RTL form; aligned to the field's start. */
export function EmailInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      type="email"
      dir="ltr"
      inputMode="email"
      autoComplete="email"
      className={cn("text-right", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        control,
        "rounded-rf-md min-h-24 resize-y px-4 py-3 text-base/[1.8]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A native select with the chevron drawn on top.
 *
 * `appearance-none` plus an absolutely positioned icon rather than a Radix
 * listbox: on a phone the native picker is better than anything reimplemented,
 * and this is only ever used for the year of birth.
 */
export function Select({
  className,
  children,
  placeholder,
  ...props
}: React.ComponentProps<"select"> & { placeholder?: string }) {
  const empty = !props.value && !props.defaultValue;
  return (
    <div className="relative">
      <select
        className={cn(
          control,
          "rounded-rf-sm h-11 min-h-11 cursor-pointer appearance-none ps-3 pe-12 text-base",
          empty && "text-rf-text-3",
          "[&>option]:text-rf-text",
          className,
        )}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      <Icon
        name="chev"
        className="text-rf-text-2 pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 rotate-90"
      />
    </div>
  );
}

/**
 * `.check` — a 20px box drawn with a CSS tick.
 *
 * The label is the hit area and wraps freely, because the one checkbox in the
 * product is the terms consent and its text runs to three lines on a phone.
 */
export function Checkbox({
  className,
  children,
  ...props
}: React.ComponentProps<"input"> & { children: React.ReactNode }) {
  return (
    <label
      className={cn("flex min-h-9 cursor-pointer items-start gap-3", className)}
    >
      <input
        type="checkbox"
        className={cn(
          "mt-2 grid size-5 shrink-0 cursor-pointer appearance-none place-items-center",
          "rounded-rf-xs border-rf-line-strong bg-rf-surface border-[1.5px]",
          "checked:border-rf-accent checked:bg-rf-accent",
          "focus-visible:outline-rf-focus outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2",
          "[[data-invalid]_&]:border-rf-danger",
          // the tick: a rotated corner, so it scales with the box
          "after:hidden after:h-[11px] after:w-[6px] after:translate-y-[-1px] after:rotate-45",
          "after:border-rf-on-accent after:border-e-[2.5px] after:border-b-[2.5px] after:content-['']",
          "checked:after:block",
        )}
        {...props}
      />
      <span className="font-rf-ui text-rf-text [&_a]:text-rf-accent py-[9px] text-sm/[1.9] [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-[3px]">
        {children}
      </span>
    </label>
  );
}

export function Hint({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "font-rf-ui text-rf-text-3 text-[13px]/[1.6]",
        "[&_a]:text-rf-accent [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-[3px]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="font-rf-ui text-rf-danger flex items-start gap-1.5 text-[13px]/[1.6] font-medium"
    >
      <Icon name="alert" size="sm" className="mt-[3px]" />
      <span>{children}</span>
    </p>
  );
}

export function OkMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-rf-ui text-rf-success flex items-start gap-1.5 text-[13px]/[1.6] font-medium">
      <Icon name="check" size="sm" className="mt-[3px]" />
      <span>{children}</span>
    </p>
  );
}
