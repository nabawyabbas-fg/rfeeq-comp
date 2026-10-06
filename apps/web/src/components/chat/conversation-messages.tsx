"use client";

import type { MyUIMessage } from "@/types/ai";
import { createContext, use } from "react";
import { useChatMessages } from "ai-sdk-zustand";

/**
 * The messages that citations and quote verification resolve against.
 *
 * Normally that is the one chat in the global store. The corpus comparison runs
 * several independent conversations on one screen, so each pane supplies its
 * own here — otherwise every pane would resolve its citations against whichever
 * chat happened to own the store.
 */
const ConversationMessagesContext = createContext<MyUIMessage[] | null>(null);

export const ConversationMessagesProvider =
  ConversationMessagesContext.Provider;

/** True when a pane has supplied its own messages. */
export const useProvidedMessages = () => use(ConversationMessagesContext);

/** The store-backed messages, for the single-chat case. */
export const useStoreMessages = () => useChatMessages<MyUIMessage>();
