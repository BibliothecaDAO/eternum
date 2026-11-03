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
  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col", className)}>
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <RealtimeChatTabs rooms={rooms} />
        <RealtimeChatOnline />
      </div>
      <RealtimeChatBody rooms={rooms} />
    </div>
  );
}

/**
 * The shell's tabs, for a place that draws them in its own row (a phone's Chat page, in its head): a tab per room, then
 * Messages, each with what is unread behind it.
 */
export function RealtimeChatTabs({ rooms }: { rooms: readonly ChatRoom[] }) {
  const actions = useRealtimeChatActions();
  const worldZones = useRealtimeChatSelector((state) => state.worldZones);
  const unreadMessages = useRealtimeChatSelector(directUnread);
  const { tab } = useShownPlace(rooms);
  return (
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
  );
}

/** How many players are online, once any are. */
export function RealtimeChatOnline() {
  const online = useRealtimeChatSelector((state) => Object.keys(state.onlinePlayers).length);
  if (online === 0) return null;
  return (
    <span data-online className="shrink-0 text-hud-label tabular-nums text-hud-cue">
      {online} {CHAT_WORDS.online}
    </span>
  );
}

/** What the chosen tab shows: a room's list, Messages, or the conversation opened from it. */
export function RealtimeChatBody({ rooms, className }: { rooms: readonly ChatRoom[]; className?: string }) {
  const actions = useRealtimeChatActions();
  const { view, zoneId, conversation, strayRoom } = useShownPlace(rooms);
  useEffect(() => {
    if (strayRoom && rooms[0]) actions.showRoom(rooms[0].zoneId);
  }, [actions, rooms, strayRoom]);
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {conversation ? (
        // Keyed by its thread: each conversation opened draws its own list, on its latest message.
        <DirectMessagesPanel key={conversation} threadId={conversation} />
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
  );
}

/**
 * Where the chat stands among this place's rooms: the view, the room shown (a room this place does not have, a game's
 * kept from another game, gives way to the first it has), its tab, and the conversation open, while its player is not
 * muted (one muted gives way to Messages, where Unmute is).
 */
const useShownPlace = (rooms: readonly ChatRoom[]) => {
  const view = useRealtimeChatSelector((state) => state.view);
  const conversation = useRealtimeChatSelector((state) =>
    state.view.kind === "conversation" && threadShown(state, state.view.threadId) ? state.view.threadId : null,
  );
  const strayRoom = view.kind === "room" && !rooms.some((room) => room.zoneId === view.zoneId);
  const zoneId = view.kind === "room" && !strayRoom ? view.zoneId : rooms[0]?.zoneId;
  const tab = view.kind === "room" ? (zoneId ?? MESSAGES) : MESSAGES;
  return { view, zoneId, tab, conversation, strayRoom };
};

/** A tab's count, shown only once something is unread. */
const shown = (count: number | undefined) => (count ? count : undefined);
