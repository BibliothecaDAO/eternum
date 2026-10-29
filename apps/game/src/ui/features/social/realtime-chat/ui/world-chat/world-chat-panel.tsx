import { formatClockTime } from "@bibliothecadao/types";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { type PlayerNames, resolveChatSenderName, usePlayerNames } from "@/hooks/use-player-profile";
import {
  useRealtimeChatActions,
  useRealtimeChatSelector,
  useRealtimeWorldZone,
  useWorldChatControls,
} from "../../hooks/use-realtime-chat";
import type { WorldChatMessage } from "../../model/types";
import { computeDateSeparators, startsRun } from "../../model/message-grouping";
import { placeMetadata, placeOf } from "../../model/place";
import { replyMetadata, replyOf } from "../../model/reply";
import { PlaceChip } from "../shared/chat-map";
import { useStickToLatest } from "@/hooks/use-stick-to-latest";
import { JumpToLatest } from "../shared/jump-to-latest";
import { useChatMentions } from "../../hooks/use-chat-mentions";
import { mentions, messageParts } from "../../model/mentions";
import { useLinkOpener } from "../shared/leaving-realms";
import { MessageComposer } from "../shared/message-composer";
import { MessageRow } from "../shared/message-row";
import { MessageText } from "../shared/message-text";
import { useShowMessage } from "../shared/use-show-message";

interface WorldChatPanelProps {
  zoneId?: string;
  /** The room's name, as its tab and its field say it. */
  name: string;
  className?: string;
}

/** A room or thread not read yet has no messages: the same empty list each render. */
const NO_MESSAGES: WorldChatMessage[] = [];

const formatWorldMessageTime = (message: WorldChatMessage) => {
  const created = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
  if (created instanceof Date && !Number.isNaN(created.getTime())) {
    return formatClockTime(created.getTime() / 1000);
  }
  return "Now";
};

/** The registered name first; the chat server's display name only for a sender this game has not registered. */
const formatSenderName = (names: PlayerNames, playerId: string, displayName?: string | null) =>
  resolveChatSenderName(names, playerId, displayName) || "Unknown adventurer";

/**
 * A room: its messages, each sender's run under their name, replies quoting what they answer, and the field. A name
 * pressed opens the conversation with that player in Messages: private messages are never written in a room.
 */
export function WorldChatPanel({ zoneId, name, className }: WorldChatPanelProps) {
  // Select value directly to prevent infinite re-renders
  const fallbackZoneId = useRealtimeChatSelector((state) => state.activeZoneId ?? Object.keys(state.worldZones)[0]);
  const resolvedZoneId = zoneId ?? fallbackZoneId;
  const hasChannelAccess = useRealtimeChatSelector((state) =>
    resolvedZoneId ? state.joinedZoneIds.includes(resolvedZoneId) : false,
  );
  // A dropped room or inbox comes back by itself: the panel says so instead of that chat is unavailable.
  const reconnecting = useRealtimeChatSelector((state) => state.connectionStatus === "reconnecting");
  const actions = useRealtimeChatActions();
  const { zone, isActive } = useRealtimeWorldZone(resolvedZoneId);
  const { sendMessage, loadHistory, markAsRead } = useWorldChatControls(resolvedZoneId);
  const messages = zone?.messages ?? NO_MESSAGES;
  // A sender's name is read as the list draws, and the list draws again when one lands.
  const names = usePlayerNames();
  const mentionable = useChatMentions();
  const links = useLinkOpener();
  const section = useRef<HTMLElement>(null);
  const quoted = useShowMessage(section);
  const [replying, setReplying] = useState<WorldChatMessage | null>(null);

  useEffect(() => {
    if (resolvedZoneId && hasChannelAccess) {
      actions.joinZone(resolvedZoneId);
      actions.setActiveZone(resolvedZoneId);
    }
  }, [actions, resolvedZoneId, hasChannelAccess]);

  useEffect(() => {
    if (isActive && resolvedZoneId) {
      markAsRead();
    }
  }, [isActive, markAsRead, resolvedZoneId]);

  // Initial load of messages
  useEffect(() => {
    if (
      hasChannelAccess &&
      resolvedZoneId &&
      zone &&
      messages.length === 0 &&
      zone.hasMoreHistory &&
      !zone.isFetchingHistory &&
      !zone.historyError
    ) {
      loadHistory(undefined);
    }
  }, [hasChannelAccess, resolvedZoneId, zone, messages.length, loadHistory]);

  const loadOlder = () => {
    if (zone?.hasMoreHistory && !zone.isFetchingHistory && !zone.historyError) {
      void loadHistory(zone.lastFetchedCursor ?? undefined);
    }
  };
  const { scrollerRef, hasNewer, jumpToLatest } = useStickToLatest({
    oldest: messages[0]?.id,
    newest: messages.at(-1)?.id,
    onNearOldest: loadOlder,
  });

  const dateSeparators = useMemo(() => computeDateSeparators(messages), [messages]);
  const byId = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  return (
    <section ref={section} className={`relative flex h-full min-h-0 flex-1 flex-col ${className ?? ""}`}>
      <div className="flex-1 min-h-0 px-3 py-2">
        {!hasChannelAccess && (
          <p className="text-hud-body text-hud-cue">{reconnecting ? "Reconnecting…" : "Chat unavailable."}</p>
        )}
        {hasChannelAccess && zone && (
          <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
            <div ref={scrollerRef} className="flex flex-1 min-h-0 flex-col overflow-y-auto pr-1">
              {zone.historyError && (
                <div className="mb-2">
                  <HudNotice
                    tone="bad"
                    line={zone.historyError}
                    retry={() => loadHistory(zone.lastFetchedCursor ?? undefined)}
                  />
                </div>
              )}
              {zone.isFetchingHistory && (
                <div className="flex justify-center py-2">
                  <span className="text-hud-label text-hud-cue">Loading older messages...</span>
                </div>
              )}

              {/* Anchored to the input: a short history sits at the bottom, next to where the reply goes. */}
              <ul className="mt-auto flex flex-col">
                {messages.map((message, index) => {
                  const senderId = message.sender.playerId;
                  const senderName = formatSenderName(names, senderId, message.sender.displayName);
                  const reply = replyOf(message.metadata);
                  const place = placeOf(message.metadata);
                  const previous = messages[index - 1];
                  const run = startsRun(
                    previous && { senderId: previous.sender.playerId, createdAt: previous.createdAt },
                    { senderId, createdAt: message.createdAt, replies: reply !== null },
                  );
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
                                name: senderName,
                                playerId: senderId,
                                avatarUrl: message.sender.avatarUrl,
                                time: formatWorldMessageTime(message),
                                onName: () => actions.openConversation(senderId),
                              }
                            : undefined
                        }
                        quote={
                          reply
                            ? {
                                name: formatSenderName(names, reply.playerId, byId.get(reply.id)?.sender.displayName),
                                excerpt: reply.excerpt,
                                onShow: () => quoted.show(reply.id),
                              }
                            : undefined
                        }
                        mentionsMe={mentions(messageParts(message.content, mentionable.names), mentionable.me)}
                        lit={quoted.lit === message.id}
                        onReply={() => setReplying(message)}
                      >
                        {place?.name !== message.content.trim() && (
                          <MessageText
                            content={message.content}
                            names={mentionable.names}
                            me={mentionable.me}
                            onLink={links.open}
                          />
                        )}
                        {place && (
                          <>
                            {" "}
                            <PlaceChip place={place} />
                          </>
                        )}
                      </MessageRow>
                    </Fragment>
                  );
                })}
                {messages.length === 0 && !zone.isFetchingHistory && !zone.historyError && (
                  <li className="text-hud-body text-hud-cue">{CHAT_WORDS.noMessages}</li>
                )}
              </ul>
            </div>
            {hasNewer && <JumpToLatest onJump={jumpToLatest} />}
          </div>
        )}
      </div>
      <MessageComposer
        onSend={async (value, place) => {
          if (!resolvedZoneId) return;
          const metadata = {
            ...(replying &&
              replyMetadata({ id: replying.id, playerId: replying.sender.playerId, content: replying.content })),
            ...(place && placeMetadata(place)),
          };
          await sendMessage({
            content: value,
            zoneId: resolvedZoneId,
            ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
          });
          setReplying(null);
        }}
        placeholder={`${CHAT_WORDS.message} ${name}`}
        disabled={!hasChannelAccess}
        mentions={mentionable.choices}
        replying={
          replying
            ? {
                name: formatSenderName(names, replying.sender.playerId, replying.sender.displayName),
                excerpt: replying.content,
                onCancel: () => setReplying(null),
              }
            : undefined
        }
      />
      {links.asking}
    </section>
  );
}
