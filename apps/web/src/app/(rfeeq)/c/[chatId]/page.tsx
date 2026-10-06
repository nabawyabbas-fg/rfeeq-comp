import { RfeeqChat } from "@/components/rfeeq/chat/chat";

/**
 * One saved conversation, by id.
 *
 * The same chat surface with a conversation preloaded — not a separate reader.
 * Ownership is enforced where the messages are fetched, so this page passes the
 * id along without needing a session of its own.
 */
export default async function SavedChatPage({ params }: PageProps<"/c/[chatId]">) {
  const { chatId } = await params;
  return <RfeeqChat initialChatId={chatId} />;
}
