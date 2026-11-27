import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudPage, HudPill } from "@/ui/design-system/kit/hud-elements";
import { CHAT, CHAT_WORDS } from "@/ui/design-system/kit/words";

import { useChatPeople } from "@/ui/features/social/realtime-chat/hooks/use-chat-people";
import { useRealtimeChatSelector } from "@/ui/features/social";
import { chatUnread } from "../model/direct-unread";
import { messageWords, placeOf, type SharedPlace } from "../model/place";
import type { RealtimeConnectionStatus } from "../model/types";

type HistoryState = "loading" | "answered" | "failed";
const historyState = (
  zone: { historyError?: string; lastFetchedCursor?: string | null; messages?: readonly unknown[] } | undefined,
  blockListReady: boolean,
): HistoryState =>
  zone?.historyError
    ? "failed"
    : zone?.lastFetchedCursor !== undefined && (blockListReady || !zone.messages?.length)
      ? "answered"
      : "loading";

const CHAT_UNAVAILABLE = "Chat unavailable";

const chatStripLine = ({
  signedIn,
  connection,
  joined,
  history,
  last,
}: {
  signedIn: boolean;
  connection: RealtimeConnectionStatus;
  joined: boolean;
  history: HistoryState;
  last: string | undefined;
}): string => {
  if (!signedIn) return CHAT_WORDS.signInToChat;
  if (connection === "connected" && !joined) return CHAT_UNAVAILABLE;
  if (last) return last;
  if (connection === "error" || history === "failed") return CHAT_UNAVAILABLE;
  return history === "answered" ? CHAT_WORDS.noMessages : "Loading chat…";
};

export const useChatStrip = ({
  zoneId,
  signedIn,
  readPlace,
}: {
  zoneId: string;
  signedIn: boolean;
  readPlace: (place: SharedPlace) => string;
}) => {
  const connection = useRealtimeChatSelector((state) => state.connectionStatus);
  const joined = useRealtimeChatSelector((state) => state.joinedZoneIds.includes(zoneId));
  const lastMessage = useRealtimeChatSelector((state) =>
    state.worldZones[zoneId]?.messages.findLast(
      (message) => state.blockList !== null && !state.blockList.blocked.includes(message.sender.playerId),
    ),
  );
  const history = useRealtimeChatSelector((state) => historyState(state.worldZones[zoneId], state.blockList !== null));
  const unread = useRealtimeChatSelector(chatUnread);
  const people = useChatPeople();
  const lastPlace = lastMessage ? placeOf(lastMessage.metadata) : null;
  const stripLine = chatStripLine({
    signedIn,
    connection,
    joined,
    history,
    last:
      lastMessage &&
      `${people.nameOf(lastMessage.sender.playerId, lastMessage.sender.displayName)}: ${messageWords(lastMessage.content, lastPlace?.name ?? null, lastPlace ? readPlace(lastPlace) : null)}`,
  });
  return { stripLine, unread };
};

export function ChatDock({
  open,
  onOpenChange,
  signedIn,
  onSignIn,
  stripLine,
  unread,
  foldToIcon = false,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedIn: boolean;
  onSignIn: () => void;
  stripLine: string;
  unread: number;
  foldToIcon?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const pane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) pane.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input,textarea")?.focus();
  }, [open]);
  return (
    <div className={cn("flex flex-col gap-2", open ? "min-h-hud-chat-least" : "shrink-0", className)}>
      {open && (
        <div ref={pane} data-chat-pane className="pointer-events-auto flex h-hud-chat-pane min-h-0 flex-col">
          <HudPage label={CHAT} icon="chat" onClose={() => onOpenChange(false)} bodyClassName="gap-0 p-0">
            {children}
          </HudPage>
        </div>
      )}
      <div className={cn("pointer-events-auto shrink-0", foldToIcon && "portrait:w-auto portrait:self-start")}>
        <HudPill
          label="Chat strip"
          aria-expanded={open}
          className="max-w-full"
          onPress={() => (signedIn ? onOpenChange(!open) : onSignIn())}
        >
          {[
            <span key="last" className="flex min-w-0 items-center gap-1.5">
              <Icon name="chat" size={20} />
              <span className={cn("min-w-0 truncate", foldToIcon && "portrait:sr-only")}>{stripLine}</span>
            </span>,
            ...(signedIn && !open && unread > 0
              ? [
                  <HudChip key="unread" label="Unread chat messages">
                    {unread}
                  </HudChip>,
                ]
              : []),
          ]}
        </HudPill>
      </div>
    </div>
  );
}
