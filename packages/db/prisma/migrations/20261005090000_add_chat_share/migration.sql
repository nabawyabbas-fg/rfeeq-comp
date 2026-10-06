-- A public, revocable link to one saved conversation.
--
-- Its own opaque key rather than reusing the chat id. The chat id already
-- appears in the owner's own URLs and in /api/chats responses, so publishing it
-- would mean anyone who had ever seen one could read the conversation, and
-- there would be no way to revoke a link short of deleting the chat. Clearing
-- shareId breaks every link handed out and leaves the conversation intact,
-- which is what "stop sharing" has to mean.
--
-- Nullable, and null is the default: a conversation is private until its owner
-- shares it. The unique index is what the public route looks a link up by.
ALTER TABLE "chat" ADD COLUMN "shareId" TEXT;
ALTER TABLE "chat" ADD COLUMN "sharedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "chat_shareId_key" ON "chat"("shareId");
