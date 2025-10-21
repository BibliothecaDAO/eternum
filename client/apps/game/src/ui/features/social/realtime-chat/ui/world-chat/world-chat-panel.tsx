import { useEffect, useMemo } from "react";

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

export function WorldChatPanel({ zoneId, zoneLabel, className }: WorldChatPanelProps) {
  // Select value directly to prevent infinite re-renders
  const fallbackZoneId = useRealtimeChatSelector((state) => state.activeZoneId ?? Object.keys(state.worldZones)[0]);
  const resolvedZoneId = zoneId ?? fallbackZoneId;
  const actions = useRealtimeChatActions();
  const { zone, isActive } = useRealtimeWorldZone(resolvedZoneId);
  const { sendMessage, loadHistory, markAsRead, setActive } = useWorldChatControls(resolvedZoneId);
  const messages = zone?.messages ?? [];

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

  const displayLabel = useMemo(() => {
    if (zoneLabel) return zoneLabel;
    if (resolvedZoneId) return `Zone ${resolvedZoneId}`;
    return "World Chat";
  }, [resolvedZoneId, zoneLabel]);

  return (
    <section className={`flex h-full flex-1 flex-col bg-neutral-900 ${className ?? ""}`}>
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
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!zone && <p className="text-sm text-neutral-500">Join a zone to view chat.</p>}
        {zone && (
          <>
            {zone.hasMoreHistory && (
              <button
                type="button"
                onClick={() => loadHistory(zone.lastFetchedCursor ?? undefined)}
                className="mb-3 w-full rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-500"
              >
                Load older messages
              </button>
            )}
            <ul className="space-y-2">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className="flex flex-col gap-1 rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100"
                >
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span>{message.sender.displayName ?? message.sender.playerId}</span>
                    <span>{formatWorldMessageTime(message)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-neutral-100">{message.content}</p>
                </li>
              ))}
              {messages.length === 0 && (
                <li className="text-sm text-neutral-500">No messages yet. Be the first to say hello!</li>
              )}
            </ul>
          </>
        )}
      </div>
      <div className="border-t border-neutral-800 p-4">
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
