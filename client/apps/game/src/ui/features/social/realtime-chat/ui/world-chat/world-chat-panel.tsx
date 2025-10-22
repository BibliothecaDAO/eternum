import { useEffect, useMemo, useRef } from "react";

import {
  useRealtimeChatActions,
  useRealtimeChatSelector,
  useRealtimeWorldZone,
  useWorldChatControls,
} from "../../hooks/use-realtime-chat";
import type { WorldChatMessage } from "../../model/types";
import { MessageComposer } from "../shared/message-composer";

interface WorldChatPanelProps {
  zoneId?: string;
  zoneLabel?: string;
  className?: string;
}

const formatWorldMessageTime = (message: WorldChatMessage) => {
  const created = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
  if (created instanceof Date && !Number.isNaN(created.getTime())) {
    return created.toLocaleTimeString();
  }
  return "Now";
};

const formatSenderName = (message: WorldChatMessage) =>
  message.sender.displayName?.trim() || message.sender.playerId || "Unknown adventurer";

const truncateWallet = (wallet?: string, visibleChars = 4) => {
  if (!wallet) return undefined;
  const normalized = wallet.trim();
  if (normalized.length <= visibleChars * 2 + 3) {
    return normalized;
  }
  return `${normalized.slice(0, visibleChars + 2)}…${normalized.slice(-visibleChars)}`;
};

export function WorldChatPanel({ zoneId, zoneLabel, className }: WorldChatPanelProps) {
  // Select value directly to prevent infinite re-renders
  const fallbackZoneId = useRealtimeChatSelector((state) => state.activeZoneId ?? Object.keys(state.worldZones)[0]);
  const resolvedZoneId = zoneId ?? fallbackZoneId;
  const actions = useRealtimeChatActions();
  const { zone, isActive } = useRealtimeWorldZone(resolvedZoneId);
  const { sendMessage, loadHistory, markAsRead, setActive } = useWorldChatControls(resolvedZoneId);
  const messages = zone?.messages ?? [];
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (resolvedZoneId) {
      actions.joinZone(resolvedZoneId);
      actions.setActiveZone(resolvedZoneId);
    }
  }, [actions, resolvedZoneId]);

  useEffect(() => {
    if (isActive && resolvedZoneId) {
      markAsRead();
    }
  }, [isActive, markAsRead, resolvedZoneId]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (isActive || isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isActive]);

  const displayLabel = useMemo(() => {
    if (zoneLabel) return zoneLabel;
    if (resolvedZoneId) return `Zone ${resolvedZoneId}`;
    return "World Chat";
  }, [resolvedZoneId, zoneLabel]);

  return (
    <section className={`flex h-full min-h-0 flex-1 flex-col bg-neutral-900 ${className ?? ""}`}>
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-200">{displayLabel}</h2>
          <p className="text-xs text-neutral-500">Live zone chat</p>
        </div>
        <button
          type="button"
          onClick={() => setActive()}
          className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-500"
        >
          Focus
        </button>
      </header>
      <div className="flex-1 min-h-0 px-4 py-3">
        {!zone && <p className="text-sm text-neutral-500">Join a zone to view chat.</p>}
        {zone && (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            {zone.hasMoreHistory && (
              <button
                type="button"
                onClick={() => loadHistory(zone.lastFetchedCursor ?? undefined)}
                className="mb-3 w-full rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100"
              >
                Load older messages
              </button>
            )}
            <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto pr-1">
              <ul className="flex flex-col gap-1.5">
                {messages.map((message) => {
                  const senderName = formatSenderName(message);
                  const walletBadge = truncateWallet(message.sender.walletAddress);
                  return (
                    <li key={message.id}>
                      <article className="flex flex-col gap-1 rounded-md py-1.5 text-sm text-neutral-100 ">
                        <header className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="max-w-[140px] truncate font-medium text-neutral-100" title={senderName}>
                              {senderName}
                            </span>
                            {walletBadge && (
                              <span
                                className="max-w-[100px] truncate rounded bg-neutral-900/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                                title={message.sender.walletAddress ?? undefined}
                              >
                                {walletBadge}
                              </span>
                            )}
                          </div>
                          <span className="whitespace-nowrap text-[10px] uppercase tracking-wide text-neutral-500">
                            {formatWorldMessageTime(message)}
                          </span>
                        </header>
                        <p className="whitespace-pre-wrap break-words text-[13px] leading-tight text-neutral-100">
                          {message.content}
                        </p>
                      </article>
                    </li>
                  );
                })}
                {messages.length === 0 && (
                  <li className="text-sm text-neutral-500">No messages yet. Be the first to say hello!</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
      <div className="">
        <MessageComposer
          onSend={async (value) => {
            if (!resolvedZoneId) return;
            await sendMessage({ content: value, zoneId: resolvedZoneId });
          }}
          placeholder={resolvedZoneId ? `Message zone ${resolvedZoneId}` : "Select a zone to chat"}
          disabled={!resolvedZoneId}
        />
      </div>
    </section>
  );
}
