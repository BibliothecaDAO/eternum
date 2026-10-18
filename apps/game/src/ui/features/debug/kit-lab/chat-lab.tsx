import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useDocumentClass } from "@/hooks/use-document-class";
import { LAB_SESSION } from "@/shell/lab/app-lab-fixtures";
import { useRealtimeChatStore } from "@/ui/features/social/realtime-chat/model/store";
import type { WorldChatMessage } from "@/ui/features/social/realtime-chat/model/types";
import { HudChatWindow } from "@/ui/features/world/containers/hud-chat-window";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Dev only: the HUD's chat at /lab/kit/chat, the real HudChatWindow and chat shell over a room the lab fills, in the
 * HUD's right column: `?state=open` the pane over a long history with its composer, `?state=closed` the strip with a
 * long last message and an unread count, `&fold=1` the strip folded to its icon on a phone held upright. The chat
 * proof (scripts/prove-hud-chat.mjs) measures each at a desktop's and a phone's size.
 */
export const ChatLab = () => {
  useDocumentClass("classic-hud");
  const [params] = useSearchParams();
  const [ready] = useState(installLabRoom);
  const open = params.get("state") === "open";
  // The session lands after the page mounts, so the real session read it starts is outdated before it answers.
  useEffect(() => {
    useIdentitySessionStore.getState().applySession(LAB_SESSION);
  }, []);
  return (
    <div className="min-h-screen bg-[#0b1418]">
      <div data-lab="chat" className="fixed inset-y-3 right-3 flex w-hud-column flex-col">
        {ready && <HudChatWindow open={open} onOpenChange={() => undefined} foldToIcon={params.get("fold") === "1"} />}
      </div>
    </div>
  );
};

const LONG_LINE = "Meet at the southern gate with the reinforcements, then hold the ridge until the spire opens. ";

/** Forty messages of a busy room; the last a long one, as the strip shows it. */
const labMessages = (): WorldChatMessage[] =>
  Array.from({ length: 40 }, (_, index) => ({
    id: `lab-${index}`,
    zoneId: GLOBAL_CHAT_CHANNEL_ID,
    sender: {
      playerId: `0x${(index % 5) + 1}`,
      displayName: ["Ada", "Aldric", "Corwin", "Isolde", "Tybalt"][index % 5],
    },
    content: index === 39 ? LONG_LINE.repeat(4) : LONG_LINE,
    createdAt: new Date(Date.UTC(2026, 9, 18, 12, index)).toISOString(),
  })) as WorldChatMessage[];

/**
 * The room the lab shows: connected, joined, its history loaded with unread messages, and the store's network steps
 * made to do nothing, so the page opens no socket and reads no history.
 */
function installLabRoom(): true {
  const { actions } = useRealtimeChatStore.getState();
  useRealtimeChatStore.setState({
    connectionStatus: "connected",
    joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID],
    activeZoneId: GLOBAL_CHAT_CHANNEL_ID,
    worldZones: {
      [GLOBAL_CHAT_CHANNEL_ID]: {
        zoneId: GLOBAL_CHAT_CHANNEL_ID,
        messages: labMessages(),
        unreadCount: 3,
        hasMoreHistory: false,
        lastFetchedCursor: undefined,
        isFetchingHistory: false,
        pendingMessages: [],
      },
    },
    unreadWorldTotal: 3,
    unreadDirectTotal: 1,
    openTabs: [
      {
        id: `world-${GLOBAL_CHAT_CHANNEL_ID}`,
        type: "world",
        label: "World",
        targetId: GLOBAL_CHAT_CHANNEL_ID,
        unreadCount: 3,
        closeable: false,
      },
    ],
    activeTabId: `world-${GLOBAL_CHAT_CHANNEL_ID}`,
    actions: {
      ...actions,
      initializeClient: () => undefined,
      resetClient: () => undefined,
      loadWorldHistory: () => Promise.resolve(),
    },
  });
  return true;
}
