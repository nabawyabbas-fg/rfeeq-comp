import { cache } from "react";
import { env } from "@/env";

import { db } from "@agentset/db/client";

/** The corpus the consumer chat answers from, and whether it can be asked. */
export interface RfeeqCorpus {
  id: string;
  slug: string;
  name: string;
  /**
   * The hosting row for this namespace, if one exists.
   *
   * The consumer chat posts to `/api/hosting-chat`, the same anonymous endpoint
   * a published deployment uses — it is IP-rate-limited and picks the
   * corpus-matched system prompt, both of which a guest-accessible surface
   * needs and the authenticated playground endpoint does not provide. That
   * endpoint resolves its configuration from the hosting row, so a namespace
   * without one cannot answer yet.
   */
  hostingId: string | null;
  /** Site-configured opening line, where one is set. */
  welcomeMessage: string | null;
}

/**
 * Resolves the single corpus the Rfeeq chat answers from.
 *
 * Three steps, narrowest first: the explicitly configured slug, then the
 * default organisation's oldest namespace, then nothing. The last case is real
 * and expected on this instance right now — the competition corpora have not
 * been ingested — so it returns null rather than throwing, and every screen is
 * written to render without a corpus. A question asked in that state fails at
 * the answer, which is the honest place for it: the shell, the settings and the
 * sign-in flow have nothing to do with retrieval.
 *
 * `cache` so one request resolves it once across the layout and the page.
 */
export const getRfeeqCorpus = cache(async (): Promise<RfeeqCorpus | null> => {
  const namespace = env.RFEEQ_NAMESPACE_SLUG
    ? // A configured slug that matches nothing is a misconfiguration, not a
      // reason to quietly answer from some other corpus.
      await db.namespace.findFirst({
        where: { slug: env.RFEEQ_NAMESPACE_SLUG },
        select: { id: true, slug: true, name: true },
      })
    : env.DEFAULT_ORGANIZATION_ID
      ? await db.namespace.findFirst({
          where: { organizationId: env.DEFAULT_ORGANIZATION_ID },
          select: { id: true, slug: true, name: true },
          orderBy: { createdAt: "asc" },
        })
      : null;

  if (!namespace) return null;

  const hosting = await db.hosting.findFirst({
    where: { namespaceId: namespace.id },
    select: { id: true, welcomeMessage: true },
  });

  return {
    ...namespace,
    hostingId: hosting?.id ?? null,
    welcomeMessage: hosting?.welcomeMessage ?? null,
  };
});
