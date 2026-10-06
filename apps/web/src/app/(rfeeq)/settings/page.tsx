import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RfeeqShell } from "@/components/rfeeq/shell/shell";
import { SettingsPage } from "@/components/rfeeq/settings/settings-page";
import { getSession } from "@/lib/auth";

import { db } from "@agentset/db/client";

export const metadata: Metadata = { title: "الإعدادات" };

export default async function Settings() {
  const session = await getSession();
  if (!session) redirect("/login?ctx=history");

  // Which method they actually sign in with, so the account section can say so
  // rather than guess. Absent means the email code, which is the default path.
  const account = await db.account.findFirst({
    where: { userId: session.user.id, providerId: { in: ["google", "apple"] } },
    select: { providerId: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <RfeeqShell>
      <SettingsPage
        birthYear={session.user.birthYear ?? null}
        signInMethod={account?.providerId ?? "email"}
      />
    </RfeeqShell>
  );
}
