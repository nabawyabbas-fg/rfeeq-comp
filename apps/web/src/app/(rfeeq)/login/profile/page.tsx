import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompleteProfile } from "@/components/rfeeq/auth/complete-profile";
import { getSession } from "@/lib/auth";
import { isProfileComplete } from "@/lib/rfeeq/profile";

import { db } from "@agentset/db/client";

export const metadata: Metadata = { title: "أكمل ملفك الشخصي" };

export default async function CompleteProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (isProfileComplete(session.user)) redirect("/");

  /*
   * How the name in the field got there changes what the reader needs to be
   * told about it. Google re-sends the name on every sign-in, so it can be
   * trusted to be current; Apple sends it only with the very first
   * authorisation, so a stale or absent one is normal and worth checking. Read
   * from the linked account rather than guessed from the avatar URL.
   */
  const account = await db.account.findFirst({
    where: { userId: session.user.id, providerId: { in: ["google", "apple"] } },
    select: { providerId: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <CompleteProfile
      defaultName={session.user.name}
      provider={
        account?.providerId === "google"
          ? "google"
          : account?.providerId === "apple"
            ? "apple"
            : null
      }
    />
  );
}
