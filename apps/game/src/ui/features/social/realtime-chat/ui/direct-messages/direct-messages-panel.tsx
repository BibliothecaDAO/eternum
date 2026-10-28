import { resolveChatSenderName, usePlayerNames } from "@/hooks/use-player-profile";
import { HudIconButton } from "@/ui/design-system/kit/hud-elements";
import { BACK, CHAT_WORDS } from "@/ui/design-system/kit/words";
import { formatClockTime } from "@bibliothecadao/types";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import {
  useDirectMessageControls,
  useDirectThread,
  useRealtimeChatSelector,
  useRealtimeTypingIndicators,
} from "../../hooks/use-realtime-chat";
import type { DirectMessage } from "../../model/types";
import { computeDateSeparators, startsRun } from "../../model/message-grouping";
import { replyMetadata, replyOf } from "../../model/reply";
import { useStickToLatest } from "@/hooks/use-stick-to-latest";
import { JumpToLatest } from "../shared/jump-to-latest";
import { useLinkOpener } from "../shared/leaving-realms";
import { MessageComposer } from "../shared/message-composer";
import { MessageRow } from "../shared/message-row";
import { MessageText } from "../shared/message-text";
import { useShowMessage } from "../shared/use-show-message";

/** A conversation names no one but its two players: no mention is read in it. */
const NO_NAMES: readonly string[] = [];

interface DirectMessagesPanelProps {
  threadId: string;
  /** Back to Messages, the list it was opened from. */
  onBack: () => void;
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

/**
 * One private conversation, opened from Messages or a player's name: the other player by name, the way back to
 * Messages, Block, the messages and the field. A player who is offline is written to all the same: the server keeps the
 * message for them and tells their devices.
 */
export function DirectMessagesPanel({ threadId: resolvedThreadId, onBack, className }: DirectMessagesPanelProps) {
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

  const onlinePlayers = useRealtimeChatSelector((state) => state.onlinePlayers);
  const names = usePlayerNames();
  const nameOf = (playerId: string) => resolveChatSenderName(names, playerId, onlinePlayers[playerId]?.displayName);
  const recipientLabel = recipientId ? nameOf(recipientId) : undefined;

  const { sendMessage, loadHistory, markAsRead } = useDirectMessageControls(resolvedThreadId, recipientId);
  const links = useLinkOpener();
  const section = useRef<HTMLElement>(null);
  const quoted = useShowMessage(section);
  const [replying, setReplying] = useState<DirectMessage | null>(null);
  const isOwn = (playerId: string) => selfAliases.includes(playerId);
  const labelOf = (playerId: string) => (isOwn(playerId) ? "You" : nameOf(playerId));
  const isRecipientBlocked = useRealtimeChatSelector(
    (state) => recipientId !== undefined && state.blockedPlayers.includes(recipientId),
  );
  const chatActions = useRealtimeChatSelector((state) => state.actions);

  // Open, it is read through its newest message: on opening, and as each new one arrives while it stays open.
  const newestId = thread?.messages.at(-1)?.id;
  useEffect(() => {
    if (resolvedThreadId) {
      markAsRead();
    }
  }, [markAsRead, resolvedThreadId, newestId]);

  // Its history is read once, when it opens: a conversation listed from the server holds only its last line until then.
  useEffect(() => {
    if (
      resolvedThreadId &&
      thread &&
      thread.lastFetchedCursor === undefined &&
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
    <section ref={section} className={`relative flex h-full min-h-0 flex-1 flex-col ${className ?? ""}`}>
      {thread && recipientId && (
        <header className="flex items-center gap-2 border-b border-hud-line px-2 py-1 text-hud-label">
          <HudIconButton icon="arrow-left" label={BACK} kind="quiet" size="sm" onClick={onBack} />
          <span className="min-w-0 flex-1 truncate text-hud-strong text-hud-ink">{recipientLabel}</span>
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
      <div className="flex-1 min-h-0 px-3 py-2">
        {thread && (
          <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
            <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto pr-1">
              {thread.isFetchingHistory && (
                <div className="flex justify-center py-2">
                  <span className="text-hud-label text-hud-cue">Loading older messages...</span>
                </div>
              )}

              <ul className="flex flex-col">
                {thread.messages.map((message, index) => {
                  const reply = replyOf(message.metadata);
                  const previous = thread.messages[index - 1];
                  const run = startsRun(previous, {
                    senderId: message.senderId,
                    createdAt: message.createdAt,
                    replies: reply !== null,
                  });
                  return (
                    <Fragment key={message.id}>
                      {dateSeparators.has(index) && (
                        <li key={`sep-${index}`} className="flex items-center gap-2 py-2 px-4">
                          <div className="flex-1 border-t border-hud-line" />
                          <span className="text-hud-label text-hud-cue">{dateSeparators.get(index)}</span>
                          <div className="flex-1 border-t border-hud-line" />
                        </li>
                      )}
                      <MessageRow
                        id={message.id}
                        run={
                          run || dateSeparators.has(index)
                            ? {
                                name: labelOf(message.senderId),
                                playerId: message.senderId,
                                time: toDisplayTime(message),
                              }
                            : undefined
                        }
                        quote={
                          reply
                            ? {
                                name: labelOf(reply.playerId),
                                excerpt: reply.excerpt,
                                onShow: () => quoted.show(reply.id),
                              }
                            : undefined
                        }
                        lit={quoted.lit === message.id}
                        onReply={() => setReplying(message)}
                      >
                        <MessageText content={message.content} names={NO_NAMES} me={null} onLink={links.open} />
                      </MessageRow>
                    </Fragment>
                  );
                })}
                {thread.messages.length === 0 && (
                  <li className="text-hud-body text-hud-cue">{CHAT_WORDS.noMessages}</li>
                )}
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
      <MessageComposer
        onSend={async (value) => {
          if (!recipientId) return;
          await sendMessage(
            value,
            replying
              ? replyMetadata({ id: replying.id, playerId: replying.senderId, content: replying.content })
              : undefined,
          );
          setReplying(null);
        }}
        placeholder={`${CHAT_WORDS.message} ${recipientLabel ?? ""}`.trim()}
        disabled={!recipientId}
        replying={
          replying
            ? { name: labelOf(replying.senderId), excerpt: replying.content, onCancel: () => setReplying(null) }
            : undefined
        }
      />
      {links.asking}
    </section>
  );
}
