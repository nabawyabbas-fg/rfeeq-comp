"use client";

import { useCallback, useRef, useState } from "react";
import { useHosting } from "@/contexts/hosting-context";
import { useNamespace } from "@/hooks/use-namespace";
import { useChatProperty } from "ai-sdk-zustand";

import { cn } from "@agentset/ui/cn";

import { ChatHistory } from "./chat-history";
import { MultimodalInput } from "./chat-input";
import { Messages } from "./messages";
import { Overview } from "./overview";
import { SuggestedActions } from "./suggested-actions";
import { useNamespaceChat } from "./use-chat";
import { useChatPersistence } from "./use-chat-persistence";
import { useHostingChat } from "./use-hosting-chat";

export default function Chat({
  type = "playground",
}: {
  type?: "playground" | "hosted";
}) {
  return type === "playground" ? <PlaygroundChat /> : <HostingChat />;
}

// Owns the composer state so typing re-renders only this subtree, not the
// chat root. Suggestions fill the input (leaving the user in control of
// sending) and fade out once it has content.
function ChatComposer({
  type,
  exampleMessages,
  suggestionsPlacement = "above",
}: {
  type: "playground" | "hosted";
  exampleMessages?: readonly string[];
  suggestionsPlacement?: "above" | "below";
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fillComposer = useCallback((text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  }, []);

  const suggestions = exampleMessages ? (
    <SuggestedActions
      exampleMessages={exampleMessages}
      onSelect={fillComposer}
      hidden={input.length > 0}
    />
  ) : null;

  return (
    <>
      {suggestionsPlacement === "above" && suggestions}
      <MultimodalInput
        type={type}
        input={input}
        setInput={setInput}
        textareaRef={textareaRef}
      />
      {suggestionsPlacement === "below" && suggestions}
    </>
  );
}

const PlaygroundChat = () => {
  useNamespaceChat();
  const namespace = useNamespace();
  useChatPersistence({ namespaceId: namespace.id });
  const isEmpty = useChatProperty((s) => s.messages.length === 0);

  return (
    <div className="bg-background flex h-[calc(100dvh-calc(var(--spacing)*20))] min-w-0 flex-col">
      <div className="flex justify-end px-4 pt-1">
        <ChatHistory namespaceId={namespace.id} />
      </div>

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <Overview
            title="Welcome to the playground"
            description="Try chatting with your data here"
          />
        </div>
      ) : (
        <Messages />
      )}

      <div className="mx-auto flex w-full flex-col gap-4 px-4 pb-4 md:max-w-3xl md:pb-6">
        <ChatComposer type="playground" />
      </div>
    </div>
  );
};

const HostingChat = () => {
  const { messages } = useHostingChat();
  const hosting = useHosting();
  const { exampleQuestions, welcomeMessage, logo } = hosting;
  useChatPersistence({
    namespaceId: hosting.namespaceId,
    hostingId: hosting.id,
  });
  const isEmpty = messages.length === 0;

  return (
    <div
      className={cn(
        "bg-background relative flex h-[calc(100dvh-64px)] min-w-0 flex-col",
        isEmpty && "items-center justify-center",
      )}
    >
      <div className="absolute top-[72px] right-4 z-10">
        <ChatHistory namespaceId={hosting.namespaceId} />
      </div>

      {isEmpty ? <Overview title={welcomeMessage} logo={logo} /> : <Messages />}

      <div className="mx-auto flex w-full flex-col gap-4 px-4 pb-4 md:max-w-3xl md:pb-6">
        <ChatComposer
          type="hosted"
          exampleMessages={exampleQuestions}
          suggestionsPlacement="below"
        />
      </div>
    </div>
  );
};
