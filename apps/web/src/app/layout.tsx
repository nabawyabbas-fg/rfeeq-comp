import "@/styles/globals.css";

import {
  Amiri,
  Amiri_Quran,
  IBM_Plex_Sans_Arabic,
  Inter,
  Scheherazade_New,
} from "next/font/google";
import { constructMetadata } from "@/lib/metadata";

import { cn } from "@agentset/ui/cn";

import Providers from "./providers";

export const metadata = constructMetadata();

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/**
 * The three Arabic faces the Rfeeq design calls for, each doing one job.
 *
 * Loaded here rather than in the consumer layout because `next/font` has to run
 * at module scope in a layout to emit its preload links, and the root layout is
 * the only one both surfaces pass through. The dashboard never references these
 * variables, so the cost to it is the preload of faces it does not paint —
 * avoided by `preload: false` on the two display faces, which only appear once
 * an answer has rendered.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

/** Body face for revealed text: a naskh with the counters to carry tashkīl. */
const scheherazade = Scheherazade_New({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-scheherazade",
  display: "swap",
  preload: false,
});

/**
 * The matn face: Amiri, which is the family Amiri Quran is the Qurʾānic cut of.
 *
 * Loaded beside it rather than instead of it because **Amiri Quran ships weight
 * 400 and nothing else**. Asking it for bold gets synthetic bold — the browser
 * smearing the outlines — which on a naskh carrying tashkīl thickens strokes
 * unevenly and blurs the diacritics into the letters they sit on. Amiri has a
 * real 700 drawn by the same hand, so a bold matn is a drawn weight rather than
 * a faked one.
 *
 * It is also the better face for a narration on its own terms: Amiri Quran's
 * differences are its Qurʾānic marks and letter forms, which a hadith does not
 * take.
 */
const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
  preload: false,
});

/** Muṣḥaf face, used only where the page image is reproduced. */
const amiriQuran = Amiri_Quran({
  subsets: ["arabic"],
  weight: ["400"],
  variable: "--font-amiri-quran",
  display: "swap",
  preload: false,
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
          inter.variable,
          plexArabic.variable,
          amiri.variable,
          scheherazade.variable,
          amiriQuran.variable,
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
