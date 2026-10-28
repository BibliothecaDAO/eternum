import type { RealtimeChatState } from "./types";

/**
 * A conversation's unread: the count the player's inbox last sent with it, in the handshake, with a message or after a
 * read on any of the player's devices. None while it is open on screen, where it is being read.
 */
export const threadUnread = (state: RealtimeChatState, threadId: string): number => {
  const self = state.identity?.playerId;
  if (!self || (state.isShellOpen && state.activeThreadId === threadId)) return 0;
  return state.dmThreads[threadId]?.thread.unreadCounts[self] ?? 0;
};

/** What is unread across the player's conversations. */
export const directUnread = (state: RealtimeChatState): number =>
  Object.keys(state.dmThreads).reduce((total, threadId) => total + threadUnread(state, threadId), 0);
