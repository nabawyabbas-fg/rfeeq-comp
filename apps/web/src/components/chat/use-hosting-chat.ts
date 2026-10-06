import { useHosting } from "@/contexts/hosting-context";
import { MyUIMessage } from "@/types/ai";
import { DefaultChatTransport } from "ai";
import { useChat } from "ai-sdk-zustand";
import { toast } from "sonner";

import { DEFAULT_CHAT_SETTINGS, useChatSettings } from "./chat-settings.store";

export function useHostingChat() {
  const hosting = useHosting();

  return useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: `/api/hosting-chat?namespaceId=${hosting.namespaceId}`,
      prepareSendMessagesRequest({ messages, body }) {
        const settings =
          useChatSettings.getState().namespaces[hosting.namespaceId] ??
          DEFAULT_CHAT_SETTINGS;
        return { body: { messages, ...body, llmModel: settings.llmModel } };
      },
    }),
    experimental_throttle: 100,
    onError: () => {
      toast.error("An error occurred, please try again!");
    },
  });
}
