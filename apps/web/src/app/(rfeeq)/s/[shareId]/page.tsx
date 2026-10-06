import type { MyUIMessage } from "@/types/ai";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedAnswer } from "@/components/rfeeq/chat/shared-answer";
import { constructMetadata } from "@/lib/metadata";

import { db } from "@agentset/db/client";

/**
 * Loads a shared conversation by its link key.
 *
 * Unauthenticated by design: the link *is* the capability. Nothing here checks
 * who is asking, because the owner handed the key out deliberately; what
 * protects the conversation is that the key is unguessable and revocable.
 */
const getShared = async (shareId: string) =>
  db.chat.findUnique({
    where: { shareId },
    select: {
      title: true,
      messages: {
        orderBy: { position: "asc" },
        select: { id: true, role: true, parts: true, metadata: true },
      },
    },
  });

export async function generateMetadata({
  params,
}: PageProps<"/s/[shareId]">): Promise<Metadata> {
  const { shareId } = await params;
  const chat = await getShared(shareId);

  return constructMetadata({
    title: chat?.title ?? "إجابة مشاركة",
    // A revoked link must not keep advertising what it used to hold, and a
    // shared conversation is not something to put in a search index.
    noIndex: true,
  });
}

export default async function SharedPage({
  params,
}: PageProps<"/s/[shareId]">) {
  const { shareId } = await params;
  const chat = await getShared(shareId);

  // not-found.tsx renders the explanation; this is what makes it a 404
  if (!chat) notFound();

  const messages = chat.messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts,
    ...(message.metadata ? { metadata: message.metadata } : {}),
  })) as unknown as MyUIMessage[];

  return <SharedAnswer messages={messages} />;
}
