import { cn } from "@agentset/ui/cn";

/**
 * The settings and «عن رفيق» page body.
 *
 * One centred column, no inner navigation — v1.4 removed the section rail,
 * since four short sections read better in sequence than behind tabs. Narrow
 * on purpose: these are forms and prose, and a 640px measure is where Arabic
 * body text stops being tiring.
 */
export function SettingsFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-rf-bg max-rf:px-4 min-h-0 flex-1 overflow-y-auto px-6 py-8",
      )}
    >
      <div className="mx-auto grid max-w-160 gap-4">
        <h1 className="font-rf-ui text-rf-h1 text-rf-text mb-2 font-bold">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}
