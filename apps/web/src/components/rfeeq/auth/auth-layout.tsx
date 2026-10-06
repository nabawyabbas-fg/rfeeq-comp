import { cn } from "@agentset/ui/cn";

import { RfeeqLogo } from "../logo";

/**
 * The sign-in frame: an illustrative half and a form half.
 *
 * The left half holds its dark palette in *both* themes (v1.6). That is a
 * deliberate exception to the theming rule rather than an oversight: it is one
 * fixed surface carrying the wordmark and an āya, and letting it follow the
 * theme made the mark change colour on a page whose whole job is to be
 * recognisable. The panel collapses below the design's breakpoint, where the
 * wordmark moves inline above the form.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-rf-bg flex h-dvh flex-col overflow-hidden">
      <div className="max-rf:grid-cols-1 grid min-h-0 flex-1 grid-cols-2">
        <aside
          className={cn(
            // locked to the dark palette, both themes — see rf-auth-panel
            "relative isolate flex flex-col items-center justify-center overflow-auto p-10",
            "rf-auth-panel max-rf:hidden",
            "motion-safe:animate-rf-sheen",
            // the geometric pattern, tinted by the mask rather than carrying
            // its own colour, drifting slowly so the panel is never quite still
            "before:absolute before:inset-0 before:-z-10 before:bg-[#4FC08D] before:opacity-[0.13]",
            "before:rf-pattern-mask before:content-['']",
            "motion-safe:before:animate-rf-drift",
            // and a vignette so the wordmark sits on an even ground
            "after:absolute after:inset-0 after:-z-10 after:content-['']",
            "after:bg-[radial-gradient(ellipse_60%_45%_at_50%_50%,rgba(27,58,48,.92)_0%,rgba(27,58,48,.7)_40%,rgba(27,58,48,0)_100%)]",
          )}
        >
          <div className="grid w-full max-w-115 justify-items-center gap-8 text-center">
            <RfeeqLogo className="w-28 text-[#4FC08D]" />

            <div className="grid justify-items-center gap-3">
              <p className="font-rf-quran text-rf-quran text-balance">
                <span className="font-rf-mushaf text-[#4FC08D]">﴿</span>
                فَاسْأَلُوا أَهْلَ الذِّكْرِ إِن كُنتُمْ لَا تَعْلَمُونَ
                <span
                  className={cn(
                    "mx-[.3em] inline-grid h-[1.55em] min-w-[1.55em] place-items-center align-middle",
                    "font-rf-quran rounded-full border-[1.5px] border-[#4FC08D] text-[.55em]/none font-normal text-[#4FC08D]",
                  )}
                >
                  ٤٣
                </span>
                <span className="font-rf-mushaf text-[#4FC08D]">﴾</span>
              </p>
              <p className="font-rf-ui text-[13px] font-medium text-[#A8B0AB]">
                سورة النحل، الآية 43
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col overflow-auto">
          <div className="max-rf:px-5 m-auto grid w-full max-w-105 gap-5 px-6 pt-6 pb-10">
            <div className="rf:hidden flex items-center gap-3">
              <RfeeqLogo className="w-[74px]" />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The screen's heading and its one line of explanation. */
export function AuthHeading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-rf-ui text-rf-h1 text-rf-text font-bold">{title}</h1>
      {children ? (
        <p className="font-rf-ui text-rf-body-sm text-rf-text-2 mt-1">
          {children}
        </p>
      ) : null}
    </div>
  );
}
