/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const makeConfig = async (): Promise<NextConfig> => {
  const { createJiti } = await import("jiti");
  await createJiti(fileURLToPath(import.meta.url)).import("./src/env.ts");

  return {
    poweredByHeader: false,

    /**
     * The dev server is reached through Caddy at the public host, not at
     * localhost, so every /_next/* request is cross-origin by Next's reckoning
     * and warns. Listing the host it is actually served at is the fix; it has
     * no effect on a production build.
     */
    allowedDevOrigins: ["comp.rfeeq.ai"],

    // No remote image hosts: the only entry here served another product's logo
    // from its CDN, and the email wordmark is text now. Add a pattern back if a
    // next/image source ever becomes external.
    images: {
      remotePatterns: [],
    },

    /** Enables hot reloading for local packages without a build step */
    transpilePackages: [
      "@agentset/db",
      "@agentset/emails",
      "@agentset/engine",
      "@agentset/jobs",
      "@agentset/storage",
      "@agentset/stripe",
      "@agentset/ui",
      "@agentset/utils",
      "@agentset/validation",
      "@agentset/webhooks",
      "@agentset/tinybird",
    ],

    /** We already do linting and typechecking as separate tasks in CI */
    typescript: { ignoreBuildErrors: true },

    async rewrites() {
      return [
        // for posthog proxy
        {
          source: "/_proxy/posthog/ingest/static/:path*",
          destination: "https://us-assets.i.posthog.com/static/:path*",
        },
        {
          source: "/_proxy/posthog/ingest/:path*",
          destination: "https://us.i.posthog.com/:path*",
        },
      ];
    },
  };
};

export default makeConfig();
