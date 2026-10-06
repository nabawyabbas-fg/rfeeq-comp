import type { Metadata } from "next";
import { RfeeqIconSprite } from "@/components/rfeeq/icon-sprite";
import { RfeeqProvider } from "@/contexts/rfeeq-context";
import { getSession } from "@/lib/auth";
import { constructMetadata } from "@/lib/metadata";
import { getRfeeqCorpus } from "@/lib/rfeeq/corpus";
import { configuredSocialProviders } from "@/lib/social-providers";

export const metadata: Metadata = constructMetadata({
  title: "رفيق — اسأل عن العلم الشرعي",
  description:
    "رفيق يجيب عن أسئلة القرآن والحديث والفقه من مصادر معتمدة، ويعرض المصدر خلف كل إجابة.",
});

/**
 * The Rfeeq consumer app.
 *
 * `dir="rtl"` sits on this wrapper rather than on `<html>` because the root
 * layout is shared with the LTR dashboard and Next.js gives a single root
 * layout no way to vary by route group. Direction inherits, so every logical
 * property below resolves correctly; what the wrapper cannot set is the
 * document's own `lang`, which is why `lang` is repeated here for the subtree.
 * Giving this group its own root layout would fix that and is the tidier end
 * state — it means moving every other top-level segment under a group of its
 * own, which is a larger change than it looks and not one to fold into this.
 */
export default async function RfeeqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved in parallel: neither depends on the other, and both are on the
  // critical path for the first paint of the shell.
  const [session, corpus] = await Promise.all([getSession(), getRfeeqCorpus()]);

  const viewer = session
    ? {
        id: session.user.id,
        name: session.user.name || session.user.email.split("@")[0] || "",
        email: session.user.email,
        image: session.user.image ?? null,
      }
    : null;

  return (
    <div dir="rtl" lang="ar" className="bg-rf-bg font-rf-ui text-rf-text">
      {/* one sprite for the whole app; every Icon references it by id */}
      <RfeeqIconSprite />

      <RfeeqProvider
        config={{
          corpus,
          viewer,
          socialProviders: configuredSocialProviders(),
        }}
      >
        {children}
      </RfeeqProvider>
    </div>
  );
}
