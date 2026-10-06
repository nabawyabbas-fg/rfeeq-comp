import type { Metadata } from "next";

import { APP_DOMAIN, APP_NAME } from "./constants";

export function constructMetadata({
  title,
  fullTitle,
  description = "Ask questions of classical and contemporary Islamic scholarship, with citations to the sources the answer rests on.",
  // No default social image: the only one available was Agentset's. A missing
  // og:image degrades to a text-only preview; a wrong-brand one does not.
  image = null,
  video,
  icons,
  url,
  canonicalUrl,
  noIndex = false,
  manifest,
}: {
  title?: string;
  fullTitle?: string;
  description?: string;
  image?: string | null;
  video?: string | null;
  icons?: Metadata["icons"];
  url?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  manifest?: string | URL | null;
} = {}): Metadata {
  return {
    title: fullTitle || (title ? `${title} | ${APP_NAME}` : APP_NAME),
    description,
    /*
     * رفيق at every size a browser asks for.
     *
     * Two cuts of one mark, because neither survives both ends: the wordmark is
     * legible from 32px up and turns to mush at 16, where a single ر keeps a
     * clean silhouette. The `sizes` hints are what let the browser choose — the
     * 16 entry is not a smaller copy of the 32, it is different art.
     *
     * The SVG is declared first and without a size, so a browser that supports
     * one takes it and scales it crisply to whatever the tab needs; the PNGs
     * remain for those that do not. `favicon.ico` is not listed because the
     * root-level file is found by convention, and it carries both sizes.
     */
    icons: icons || [
      {
        rel: "icon",
        type: "image/svg+xml",
        url: "/icons/rfeeq-mark.svg",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        url: "/icons/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        url: "/icons/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        url: "/icons/favicon-16x16.png",
      },
    ],
    openGraph: {
      title,
      description,
      ...(image && {
        images: image,
      }),
      url,
      ...(video && {
        videos: video,
      }),
    },
    twitter: {
      title,
      description,
      ...(image && {
        card: "summary_large_image",
        images: [image],
      }),
      ...(video && {
        player: video,
      }),
    },
    // icons,
    metadataBase: new URL(APP_DOMAIN),
    ...((url || canonicalUrl) && {
      alternates: {
        canonical: url || canonicalUrl,
      },
    }),
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
    ...(manifest && {
      manifest,
    }),
  };
}
