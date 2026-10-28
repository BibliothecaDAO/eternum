import type { DirectMessage, RealtimeChatState } from "./types";

/** Open on screen: the conversation shown while the chat is shown. */
const isOpen = (state: RealtimeChatState, threadId: string) => state.isShellOpen && state.activeThreadId === threadId;

/**
 * A conversation's unread: the count the player's inbox last sent with it, in the handshake, with a message or after a
 * read on any of the player's devices. None while it is open on screen, where it is being read.
 */
export const threadUnread = (state: RealtimeChatState, threadId: string): number => {
  const self = state.identity?.playerId;
  if (!self || isOpen(state, threadId)) return 0;
  return state.dmThreads[threadId]?.thread.unreadCounts[self] ?? 0;
};

/**
 * The line the player is to tell the server they read through, or null. Due while the conversation is open on screen
 * and the server counts unread in it: the other player's newest line the client holds, however it came (the handshake,
 * a message, a history page), unless this connection already told it. A new connection tells it again, since a receipt
 * on the one before may never have arrived; the server reads through a line only once.
 */
export const receiptDue = (state: RealtimeChatState, threadId: string): DirectMessage | null => {
  const self = state.identity?.playerId;
  const held = state.dmThreads[threadId];
  if (!self || !held || !isOpen(state, threadId) || !held.thread.unreadCounts[self]) return null;
  const newest = held.messages.findLast((line) => line.senderId !== self);
  return newest && newest.id !== held.receiptSent ? newest : null;
};

/** What is unread across the player's conversations. */
export const directUnread = (state: RealtimeChatState): number =>
  Object.keys(state.dmThreads).reduce((total, threadId) => total + threadUnread(state, threadId), 0);
