import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudTabs } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import { useEffect } from "react";

import { useRealtimeChatActions, useRealtimeChatSelector } from "../hooks/use-realtime-chat";
import type { ChatRoom } from "../model/chat-rooms";
import { directUnread, threadShown } from "../model/direct-unread";
import { DirectMessagesPanel } from "./direct-messages/direct-messages-panel";
import { MessagesList } from "./direct-messages/messages-list";
import { WorldChatPanel } from "./world-chat/world-chat-panel";

const MESSAGES = "messages";

/**
 * The chat, wherever it stands (a desktop's rail, a phone's page): a tab for each room the player has, then Messages,
 * the private conversations, never mixed into a room (owner, 28 October 2026: "I think B is better, its a bit weird
 * mixing the dm with the global chat imo"). A tab carries what is unread behind it; beside the tabs, how many players
 * are online. A room's list, or Messages and the
 * conversation opened from it, fills the rest. Its connection is held elsewhere (GameChatConnection), so opening and
 * closing it never reconnects.
 */
export function RealtimeChatShell({ rooms, className }: { rooms: readonly ChatRoom[]; className?: string }) {
  const actions = useRealtimeChatActions();
  const view = useRealtimeChatSelector((state) => state.view);
  const worldZones = useRealtimeChatSelector((state) => state.worldZones);
  const unreadMessages = useRealtimeChatSelector(directUnread);
  // A conversation opened shows while its player is not muted; one muted gives way to Messages, where Unmute is.
  const conversation = useRealtimeChatSelector((state) =>
    state.view.kind === "conversation" && threadShown(state, state.view.threadId) ? state.view.threadId : null,
  );
  const online = useRealtimeChatSelector((state) => Object.keys(state.onlinePlayers).length);
  // A room this place does not have (a game's, kept from another game) gives way to the first it has.
  const strayRoom = view.kind === "room" && !rooms.some((room) => room.zoneId === view.zoneId);
  useEffect(() => {
    if (strayRoom && rooms[0]) actions.showRoom(rooms[0].zoneId);
  }, [actions, rooms, strayRoom]);

  const zoneId = view.kind === "room" && !strayRoom ? view.zoneId : rooms[0]?.zoneId;
  const tab = view.kind === "room" ? (zoneId ?? MESSAGES) : MESSAGES;
  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-hud-line px-2 py-1">
        <HudTabs
          size="sm"
          tabs={[
            ...rooms.map((room) => ({
              key: room.zoneId,
              label: room.label,
              count: shown(worldZones[room.zoneId]?.unreadCount),
            })),
            { key: MESSAGES, label: CHAT_WORDS.messages, count: shown(unreadMessages) },
          ]}
          value={tab}
          onChange={(key) => (key === MESSAGES ? actions.showMessages() : actions.showRoom(key))}
        />
        {online > 0 && (
          <span data-online className="shrink-0 text-hud-label tabular-nums text-hud-cue">
            {online} {CHAT_WORDS.online}
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {conversation ? (
          // Keyed by its thread: each conversation opened draws its own list, on its latest message.
          <DirectMessagesPanel key={conversation} threadId={conversation} onBack={actions.showMessages} />
        ) : view.kind !== "room" ? (
          <MessagesList />
        ) : (
          zoneId && (
            <WorldChatPanel
              key={zoneId}
              zoneId={zoneId}
              name={rooms.find((room) => room.zoneId === zoneId)?.label ?? ""}
            />
          )
        )}
      </div>
    </div>
  );
}

/** A tab's count, shown only once something is unread. */
const shown = (count: number | undefined) => (count ? count : undefined);
