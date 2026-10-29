import { formatClockTime } from "@bibliothecadao/types";
import { Fragment, useEffect, useMemo } from "react";

import {
  useDirectMessageControls,
  useDirectThread,
  useRealtimeChatSelector,
  useRealtimeTypingIndicators,
} from "../../hooks/use-realtime-chat";
import type { DirectMessage } from "../../model/types";
import { computeDateSeparators } from "../../model/message-grouping";
import { useStickToLatest } from "@/hooks/use-stick-to-latest";
import { JumpToLatest } from "../shared/jump-to-latest";
import { MessageComposer } from "../shared/message-composer";
import { UserAvatar } from "../shared/user-avatar";

interface DirectMessagesPanelProps {
  threadId?: string;
  className?: string;
}

/** A room or thread not read yet has no messages: the same empty list each render. */
const NO_MESSAGES: DirectMessage[] = [];

const toDisplayTime = (message: DirectMessage) => {
  const created = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
  if (created instanceof Date && !Number.isNaN(created.getTime())) {
    return formatClockTime(created.getTime() / 1000);
  }
  return "Now";
};

const truncateIdentifier = (value: string, visibleChars = 4) => {
  if (!value) return value;
  const normalized = value.trim();
  if (normalized.length <= visibleChars * 2 + 3) {
    return normalized;
  }
  return `${normalized.slice(0, visibleChars + 2)}…${normalized.slice(-visibleChars)}`;
};

export function DirectMessagesPanel({ threadId, className }: DirectMessagesPanelProps) {
  // Select values individually to prevent infinite re-renders
  const fallbackThreadId = useRealtimeChatSelector((state) => state.activeThreadId ?? Object.keys(state.dmThreads)[0]);
  const resolvedThreadId = threadId ?? fallbackThreadId;
  const { thread } = useDirectThread(resolvedThreadId);
  const identity = useRealtimeChatSelector((state) => state.identity);
  const identityId = identity?.playerId ?? "";
  const typingIndicators = useRealtimeTypingIndicators();

  const selfAliases = useMemo(() => {
    const aliases: string[] = [];
    if (identityId) {
      aliases.push(identityId);
    }
    return aliases;
  }, [identityId]);

  const recipientId = useMemo(() => {
    if (!thread?.thread) return undefined;
    return (
      thread.thread.participants.find((participant: string) => !selfAliases.includes(participant)) ??
      thread.thread.participants[0]
    );
  }, [selfAliases, thread]);

  const recipientLabel = useMemo(() => {
    if (!recipientId) return undefined;
    return truncateIdentifier(recipientId, 6);
  }, [recipientId]);

  const onlinePlayers = useRealtimeChatSelector((state) => state.onlinePlayers);
  const isRecipientOnline = useMemo(() => {
    if (!recipientId) return false;
    return onlinePlayers[recipientId]?.isOnline ?? false;
  }, [recipientId, onlinePlayers]);

  const { sendMessage, loadHistory, markAsRead } = useDirectMessageControls(resolvedThreadId, recipientId);
  const isRecipientBlocked = useRealtimeChatSelector(
    (state) => recipientId !== undefined && state.blockedPlayers.includes(recipientId),
  );
  const chatActions = useRealtimeChatSelector((state) => state.actions);

  useEffect(() => {
    if (resolvedThreadId) {
      markAsRead();
    }
  }, [markAsRead, resolvedThreadId]);

  // Initial load of messages
  useEffect(() => {
    if (
      resolvedThreadId &&
      thread &&
      thread.messages.length === 0 &&
      thread.hasMoreHistory &&
      !thread.isFetchingHistory
    ) {
      loadHistory(undefined);
    }
  }, [resolvedThreadId, thread, loadHistory]);

  const typing = useMemo(() => {
    if (!resolvedThreadId) return [];
    return Object.values(typingIndicators).filter(
      (indicator) => indicator.threadId === resolvedThreadId && indicator.isTyping,
    );
  }, [resolvedThreadId, typingIndicators]);

  const dmMessages = thread?.messages ?? NO_MESSAGES;
  const dateSeparators = useMemo(() => computeDateSeparators(dmMessages), [dmMessages]);

  const loadOlder = () => {
    if (thread?.hasMoreHistory && !thread.isFetchingHistory) void loadHistory(thread.lastFetchedCursor ?? undefined);
  };
  const { scrollerRef, hasNewer, jumpToLatest } = useStickToLatest({
    oldest: dmMessages[0]?.id,
    newest: dmMessages.at(-1)?.id,
    onNearOldest: loadOlder,
  });

  return (
    <section className={`flex h-full min-h-0 flex-1 flex-col ${className ?? ""}`}>
      {thread && recipientId && (
        <header className="flex items-center justify-between gap-2 border-b border-hud-line px-4 py-2 text-hud-label">
          <span className="text-hud-muted">{recipientLabel}</span>
          <button
            type="button"
            className="rounded border border-hud-line px-2 py-0.5 text-hud-accent hover:bg-hud-hover"
            onClick={() =>
              (isRecipientBlocked
                ? chatActions.unblockPlayer(recipientId)
                : chatActions.blockPlayer(recipientId)
              ).catch((error) => console.error("chat_block_failed", error))
            }
          >
            {isRecipientBlocked ? "Unblock" : "Block"}
          </button>
        </header>
      )}
      <div className="flex-1 min-h-0 px-4 py-3">
        {!thread && <p className="text-hud-body text-hud-cue">Select a conversation to get started.</p>}
        {thread && (
          <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
            <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto pr-1">
              {thread.isFetchingHistory && (
                <div className="flex justify-center py-2">
                  <span className="text-hud-label text-hud-cue">Loading older messages...</span>
                </div>
              )}

              <ul className="flex flex-col gap-0.5">
                {thread.messages.map((message, index) => {
                  const isOwn = selfAliases.includes(message.senderId);
                  const displayLabel = isOwn
                    ? "You"
                    : (onlinePlayers[message.senderId]?.displayName ?? truncateIdentifier(message.senderId));
                  return (
                    <Fragment key={message.id}>
                      {dateSeparators.has(index) && (
                        <li key={`sep-${index}`} className="flex items-center gap-2 py-2 px-4">
                          <div className="flex-1 border-t border-hud-line" />
                          <span className="text-hud-label text-hud-cue">{dateSeparators.get(index)}</span>
                          <div className="flex-1 border-t border-hud-line" />
                        </li>
                      )}
                      <li className="flex items-start gap-2 text-hud-body leading-snug text-hud-ink">
                        <UserAvatar
                          name={displayLabel}
                          address={message.senderId}
                          size="sm"
                          className="mt-0.5 shrink-0"
                        />
                        <p className="min-w-0 flex-1 break-words">
                          <span className="text-hud-cue">[{toDisplayTime(message)}]</span>{" "}
                          <span className="text-hud-accent">&lt;{displayLabel}&gt;</span> {message.content}
                        </p>
                      </li>
                    </Fragment>
                  );
                })}
                {thread.messages.length === 0 && <li className="text-hud-body text-hud-cue">No messages yet.</li>}
              </ul>
            </div>
            {hasNewer && <JumpToLatest onJump={jumpToLatest} />}
            {typing.length > 0 && (
              <div className="px-4 py-1 text-hud-label text-hud-cue italic">
                {typing.length === 1 ? "Someone is" : `${typing.length} people are`} typing
                <span className="animate-pulse">...</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        <MessageComposer
          onSend={async (value) => {
            if (!recipientId) return;
            await sendMessage(value);
          }}
          placeholder={recipientLabel ? `Message ${recipientLabel}` : "Select a conversation to send a message"}
          disabled={!recipientId}
          isRecipientOffline={!isRecipientOnline && !!recipientId}
          recipientName={recipientLabel}
        />
      </div>
    </section>
  );
}
