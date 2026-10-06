-- CreateTable
CREATE TABLE "chat" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "namespaceId" TEXT NOT NULL,
    "hostingId" TEXT,
    "userId" TEXT,
    "anonymousId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_namespaceId_userId_updatedAt_idx" ON "chat"("namespaceId", "userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "chat_namespaceId_anonymousId_updatedAt_idx" ON "chat"("namespaceId", "anonymousId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "chat_message_chatId_position_idx" ON "chat_message"("chatId", "position");

-- AddForeignKey
ALTER TABLE "chat" ADD CONSTRAINT "chat_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "namespace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat" ADD CONSTRAINT "chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
