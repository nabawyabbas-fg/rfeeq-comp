import { create } from "zustand";

/**
 * The saved chat the current conversation belongs to.
 *
 * Lifted out of the persistence hook so the history panel can switch
 * conversations: loading a saved chat sets this, and starting a new one clears
 * it, which is what stops the next turn overwriting the chat you just left.
 */
interface ActiveChatState {
  chatId: string | null;
  setChatId: (chatId: string | null) => void;
}

export const useActiveChat = create<ActiveChatState>((set) => ({
  chatId: null,
  setChatId: (chatId) => set({ chatId }),
}));
