import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useDocumentClass } from "@/hooks/use-document-class";
import { LAB_SESSION } from "@/shell/lab/app-lab-fixtures";
import { useRealtimeChatStore } from "@/ui/features/social/realtime-chat/model/store";
import type { WorldChatMessage } from "@/ui/features/social/realtime-chat/model/types";
import { HudButton, HudEventRow, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { HudChatWindow } from "@/ui/features/world/containers/hud-chat-window";
import { EventsPanel } from "@/ui/features/world/hud/events-card";
import { RailFrame, TileDetails } from "@/ui/features/world/hud/guided-rail";
import { BuildTag } from "@/ui/layouts/build-tag";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Dev only: the HUD's chat at /lab/kit/chat, the real HudChatWindow and chat shell over a room the lab fills, in the
 * HUD's right column: `?state=open` the pane over a long history with its composer, `?state=closed` the strip with a
 * long last message and an unread count, `&fold=1` the strip folded to its icon on a phone held upright. `?state=rail`
 * puts it in the real rail over a stand-in map: the Events panel with its Log count, a picked army's details and its
 * biome, chat open (`&chat=closed` its strip), and the build tag in the base band. The chat proof
 * (scripts/prove-hud-chat.mjs) measures each at a desktop's and a phone's size.
 */
export const ChatLab = () => {
  useDocumentClass("classic-hud");
  const [params] = useSearchParams();
  const [ready] = useState(installLabRoom);
  const state = params.get("state");
  // The session lands after the page mounts, so the real session read it starts is outdated before it answers.
  useEffect(() => {
    useIdentitySessionStore.getState().applySession(LAB_SESSION);
  }, []);
  if (state === "rail") return ready ? <RailLab chatOpen={params.get("chat") !== "closed"} /> : null;
  const open = state === "open";
  return (
    <div className="min-h-screen bg-[#0b1418]">
      <div data-lab="chat" className="fixed inset-y-3 right-3 flex w-hud-column flex-col">
        {ready && <HudChatWindow open={open} onOpenChange={() => undefined} foldToIcon={params.get("fold") === "1"} />}
      </div>
    </div>
  );
};

const noop = () => undefined;

/**
 * The rail as the desktop HUD stacks it, over a canvas standing in for the map: what is always on (Next up, Events with
 * eleven unread), a picked army's tile and its biome, then chat; the build tag in the band under the columns.
 */
const RailLab = ({ chatOpen }: { chatOpen: boolean }) => (
  <div className="fixed inset-0">
    <canvas data-lab="map" className="absolute inset-0 h-full w-full bg-[#0b1418]" />
    <RailFrame>
      <HudPanel label="Next up" title="Next up" cue="1 of 5">
        <p className="text-hud-body text-hud-ink">Your army can explore: +5 points a tile.</p>
        <HudButton kind="primary" className="mt-2 w-full">
          Select the army
        </HudButton>
      </HudPanel>
      <EventsPanel logOpen={false} onLogToggle={noop} unread={11}>
        {LAB_EVENTS.map(([time, line]) => (
          <HudEventRow key={time} time={time} icon="army">
            {line}
          </HudEventRow>
        ))}
      </EventsPanel>
      <TileDetails>
        <HudPanel label="Army tile" title="Army Tile · (15, 8)">
          {LAB_ARMY.map(([title, detail]) => (
            <p key={title} className="flex justify-between py-1 text-hud-body text-hud-ink">
              <span>{title}</span>
              <span className="text-hud-muted">{detail}</span>
            </p>
          ))}
        </HudPanel>
        <HudPanel label="Biome" title="Biome" cue="Battle">
          {LAB_BIOME.map(([troop, effect]) => (
            <p key={troop} className="flex justify-between py-2 text-hud-body text-hud-ink">
              <span>{troop}</span>
              <span className="text-hud-muted">{effect}</span>
            </p>
          ))}
        </HudPanel>
      </TileDetails>
      <HudChatWindow open={chatOpen} onOpenChange={noop} />
    </RailFrame>
    <BuildTag />
  </div>
);

const LAB_EVENTS = [
  ["18:18", "Army raised at Hetokamohuti"],
  ["18:16", "Explored · (15, 8): +5 points, +50 Essence"],
  ["18:14", "Explored · (15, 7): +5 points, +200 Essence"],
];
const LAB_ARMY = [
  ["clientlane", "Stolsli"],
  ["Knights T1", "1,000"],
  ["Stamina", "97/120"],
  ["Rested in", "1 min"],
];
const LAB_BIOME = [
  ["Knights", "0%"],
  ["Crossbowmen", "+30%"],
  ["Paladins", "-30%"],
];

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
