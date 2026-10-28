import { formatClockTime } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";

import { Fragment, useCallback, useEffect, useMemo } from "react";

import { Position } from "@bibliothecadao/eternum";
import { openOnMap } from "@/play/navigation/open-place";
import { type PlayerNames, resolveChatSenderName, usePlayerNames } from "@/hooks/use-player-profile";
import {
  useRealtimeChatActions,
  useRealtimeChatSelector,
  useRealtimeWorldZone,
  useWorldChatControls,
} from "../../hooks/use-realtime-chat";
import type { WorldChatMessage } from "../../model/types";
import { computeDateSeparators } from "../../model/message-grouping";
import { useStickToLatest } from "@/hooks/use-stick-to-latest";
import { JumpToLatest } from "../shared/jump-to-latest";
import { useChatMentions } from "../../hooks/use-chat-mentions";
import { mentions, messageParts } from "../../model/mentions";
import { MessageComposer } from "../shared/message-composer";
import { UserAvatar } from "../shared/user-avatar";

interface WorldChatPanelProps {
  zoneId?: string;
  /** The room's name, as its tab and its field say it. */
  name: string;
  className?: string;
}

// Coordinate navigation button component
const CoordinateNavButton = ({
  coordinates,
  onNavigate,
}: {
  coordinates: { x: number; y: number };
  onNavigate?: (coordinates: { x: number; y: number }) => void;
}) => {
  return (
    <button
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-hud-accent hover:text-hud-cue transition-colors duration-200 rounded bg-hud-chosen hover:bg-hud-chosen"
      onClick={() => onNavigate?.(coordinates)}
    >
      <span className="text-hud-label">{`${coordinates.x}, ${coordinates.y}`}</span>
      <SemanticIcon name="location" className="w-3 h-3" />
    </button>
  );
};

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
const formatSenderName = (names: PlayerNames, message: WorldChatMessage) =>
  resolveChatSenderName(names, message.sender.playerId, message.sender.displayName) || "Unknown adventurer";

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
  const handleNavigateToCoordinates = useCallback((coordinates: { x: number; y: number }) => {
    openOnMap(Position.fromNormalized({ x: coordinates.x, y: coordinates.y }), "tile");
  }, []);

  // A sender's name opens Messages' conversation with them: private messages are never written in a room.
  const handleUserClick = (userId: string) => actions.openConversation(userId);

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

  return (
    <section className={`flex h-full min-h-0 flex-1 flex-col ${className ?? ""}`}>
      <div className="flex-1 min-h-0 px-4 py-3">
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
              <ul className="mt-auto flex flex-col gap-0.5">
                {messages.map((message, index) => {
                  const senderName = formatSenderName(names, message);
                  const parts = messageParts(message.content, mentionable.names);
                  const mentionsMe = mentions(parts, mentionable.me);
                  return (
                    <Fragment key={message.id}>
                      {dateSeparators.has(index) && (
                        <li key={`sep-${index}`} className="flex items-center gap-2 py-2 px-4">
                          <div className="flex-1 border-t border-hud-line" />
                          <span className="text-hud-label text-hud-cue">{dateSeparators.get(index)}</span>
                          <div className="flex-1 border-t border-hud-line" />
                        </li>
                      )}
                      {/* Every message carries its author: avatar, time and name, then the text. One that mentions the
                          player is marked for them. */}
                      <li
                        data-mentions-me={mentionsMe || undefined}
                        className={`flex items-start gap-2 rounded text-hud-body leading-snug text-hud-ink ${
                          mentionsMe ? "bg-hud-chosen" : ""
                        }`}
                      >
                        <UserAvatar
                          name={senderName}
                          address={message.sender.playerId}
                          avatarUrl={message.sender.avatarUrl}
                          size="sm"
                          className="mt-0.5 shrink-0"
                        />
                        <p className="min-w-0 flex-1 break-words">
                          <span className="text-hud-cue">[{formatWorldMessageTime(message)}]</span>{" "}
                          <span
                            onClick={() => handleUserClick(message.sender.playerId)}
                            className="cursor-pointer text-hud-accent transition-colors hover:text-hud-accent"
                            title={`${CHAT_WORDS.message} ${senderName}`}
                          >
                            &lt;{senderName}&gt;
                          </span>{" "}
                          {parts.map((part, i) =>
                            part.type === "text" ? (
                              <span key={i}>{part.text}</span>
                            ) : part.type === "mention" ? (
                              <span
                                key={i}
                                data-mention={part.name}
                                className={part.name === mentionable.me ? "text-hud-gold" : "text-hud-accent"}
                              >
                                {part.text}
                              </span>
                            ) : (
                              <CoordinateNavButton
                                key={i}
                                coordinates={part}
                                onNavigate={handleNavigateToCoordinates}
                              />
                            ),
                          )}
                        </p>
                      </li>
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
      <div className="">
        <MessageComposer
          onSend={async (value) => {
            if (!resolvedZoneId) return;
            await sendMessage({ content: value, zoneId: resolvedZoneId });
          }}
          placeholder={`${CHAT_WORDS.message} ${name}`}
          disabled={!hasChannelAccess}
          mentions={mentionable.choices}
        />
      </div>
    </section>
  );
}
