import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useDocumentClass } from "@/hooks/use-document-class";
import { useGame } from "@/hooks/context/game-context";
import { LAB_SEAT_PROFILES, LAB_SESSION } from "@/shell/lab/app-lab-fixtures";
import { replyMetadata } from "@/ui/features/social/realtime-chat/model/reply";
import { useRealtimeChatStore } from "@/ui/features/social/realtime-chat/model/store";
import type {
  DirectMessage,
  DirectMessageThreadState,
  WorldChatMessage,
} from "@/ui/features/social/realtime-chat/model/types";
import { HudButton, HudEventRow, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { HudChatWindow } from "@/ui/features/world/containers/hud-chat-window";
import { EventsPanel } from "@/ui/features/world/hud/events-card";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { RailFrame, TileDetails } from "@/ui/features/world/hud/guided-rail";
import { BuildTag } from "@/ui/layouts/build-tag";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { type ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TileGame } from "./panels-lab";

/**
 * Dev only: the HUD's chat at /lab/kit/chat, the real HudChatWindow and chat shell over a room the lab fills, in the
 * HUD's right column: `?state=open` the pane over a long history with its composer, `?state=closed` the strip with a
 * long last message and an unread count (pressed, it opens the pane as the game's does), `&fold=1` the strip folded to
 * its icon on a phone held upright. `&view=messages` opens Messages (three conversations, one unread),
 * `&view=conversation` the one with Isolde, who is offline. **A message arrives** delivers another player's message to
 * the room, as the chat's socket does. `?state=rail` puts it in the real rail over a stand-in map: the Events panel with
 * its Log count, a picked army's details and its biome, chat open (`&chat=closed` its strip), and the build tag in the
 * base band. The chat proof (scripts/prove-hud-chat.mjs) measures each at a desktop's and a phone's size. The room's
 * speakers and four more are the lab game's players, named as identity names them, so "@" in the composer lists them;
 * two messages mention a player, one of them the lab's own (Maelis). What the lab's player sends, the room echoes back.
 */
export const ChatLab = () => {
  useDocumentClass("classic-hud");
  const [params] = useSearchParams();
  const [ready] = useState(() => installLabRoom(params.get("view")));
  const state = params.get("state");
  const [open, setOpen] = useState(state === "open");
  // The session lands after the page mounts, so the real session read it starts is outdated before it answers.
  useEffect(() => {
    useIdentitySessionStore.getState().applySession(LAB_SESSION);
  }, []);
  if (state === "rail") return ready ? <RailLab chatOpen={params.get("chat") !== "closed"} /> : null;
  return (
    <div className="min-h-screen bg-[#0b1418]">
      <div className="fixed left-3 top-28 z-10">
        <HudButton kind="secondary" size="sm" data-lab="arrive" onClick={deliverLabMessage}>
          A message arrives
        </HudButton>
      </div>
      <div data-lab="chat" className="fixed inset-y-3 right-3 flex w-hud-column flex-col">
        {ready && (
          <TileGame tile="army">
            <RoomPlayers>
              <HudChatWindow open={open} onOpenChange={setOpen} foldToIcon={params.get("fold") === "1"} />
            </RoomPlayers>
          </TileGame>
        )}
      </div>
    </div>
  );
};

/** The room's players as the game's own: a PlayerEntry each, in the lab game's store, before chat reads them. */
const RoomPlayers = ({ children }: { children: ReactNode }) => {
  const { store } = useGame().setup;
  useState(() =>
    store.applyFacts(
      ROOM_PLAYERS.map((address) => ({
        model: "PlayerEntry",
        key: `0xe${address.slice(2)}`,
        value: { game_id: 1, owner: address, player: address },
      })) as never,
    ),
  );
  return children;
};

const noop = () => undefined;

/**
 * The rail as the desktop HUD stacks it, over a canvas standing in for the map: what is always on (Next up, Events with
 * eleven unread), the real picked-army tile of the panels lab (`/lab/kit/panels?tile=army`), then chat; the build tag
 * in the band under the columns.
 */
const RailLab = ({ chatOpen }: { chatOpen: boolean }) => (
  <TileGame tile="army">
    <RoomPlayers>
      <RailStage chatOpen={chatOpen} />
    </RoomPlayers>
  </TileGame>
);

const RailStage = ({ chatOpen }: { chatOpen: boolean }) => (
  <div className="fixed inset-0">
    <canvas data-lab="map" className="absolute inset-0 z-0 h-full w-full bg-[#0b1418]" />
    <RailFrame chat={<HudChatWindow open={chatOpen} onOpenChange={noop} />} chatOpen={chatOpen}>
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
        <SelectedWorldmapEntity />
      </TileDetails>
    </RailFrame>
    <BuildTag />
  </div>
);

const LAB_EVENTS = [
  ["18:18", "Army raised at Hetokamohuti"],
  ["18:16", "Explored: +50 Essence"],
  ["18:14", "Explored: +200 Essence"],
];
const LONG_LINE = "Meet at the southern gate with the reinforcements, then hold the ridge until the spire opens. ";

/** The lab game's players: the lobby lab's nine seats, whose names identity answers (LAB_SEAT_PROFILES). */
const ROOM_PLAYERS = Object.keys(LAB_SEAT_PROFILES);

/**
 * What the last messages say: a count in thousands (words, never a place), two links (Realms' docs, and a site off
 * Realms that asks first), a reply to the message before it, a mention of another player and one of the lab's own.
 */
const MENTIONS: Record<number, string> = {
  33: "sent 1,200 knights at the ruin, 3,046 left at home",
  34: "the rules: https://docs.realms.party/frontier/expedition and my run https://www.youtube.com/watch?v=ruin-run",
  35: "the camps and rifts, that is where the labor is",
  37: "@Aldric hold the ridge, the spire opens at dusk.",
  38: `@${LAB_SESSION.user.name} your army is at the southern gate.`,
};
/** The message that answers another: 35 answers 33. */
const REPLIES: Record<number, number> = { 35: 33 };

/** Forty messages of a busy room from five of its players; the last a long one, as the strip shows it. */
const labMessages = (): WorldChatMessage[] =>
  Array.from({ length: 40 }, (_, index) => {
    const playerId = ROOM_PLAYERS[index % 5]!;
    return {
      id: `lab-${index}`,
      zoneId: GLOBAL_CHAT_CHANNEL_ID,
      sender: { playerId, displayName: LAB_SEAT_PROFILES[playerId]!.name },
      content: MENTIONS[index] ?? (index === 39 ? LONG_LINE.repeat(2) : LONG_LINE),
      createdAt: new Date(Date.UTC(2026, 9, 18, 12, index)).toISOString(),
      ...(REPLIES[index] !== undefined ? { metadata: labReply(REPLIES[index]!) } : {}),
    };
  }) as WorldChatMessage[];

/** A reply's metadata, answering the lab's message `answered`. */
const labReply = (answered: number) =>
  replyMetadata({
    id: `lab-${answered}`,
    playerId: ROOM_PLAYERS[answered % 5]!,
    content: MENTIONS[answered] ?? LONG_LINE,
  });

/** Identity's answer for the room's players, as the identity Worker serves their names; anything else goes on. */
const answerRoomProfiles = () => {
  const network = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.pathname !== "/api/profiles") return network(input, init);
    const accounts = url.searchParams.get("accounts")?.split(",") ?? [];
    const profiles = Object.fromEntries(
      accounts.flatMap((a) => (LAB_SEAT_PROFILES[a] ? [[a, LAB_SEAT_PROFILES[a]]] : [])),
    );
    return Promise.resolve(Response.json({ profiles }));
  };
};

/** Another player's message, through the store's own receive path, numbered after the history. */
const deliverLabMessage = () => {
  const { worldZones, actions } = useRealtimeChatStore.getState();
  const index = worldZones[GLOBAL_CHAT_CHANNEL_ID]?.messages.length ?? 0;
  actions.receiveWorldMessage(GLOBAL_CHAT_CHANNEL_ID, {
    id: `lab-arrived-${index}`,
    zoneId: GLOBAL_CHAT_CHANNEL_ID,
    sender: { playerId: "0x6", displayName: "Rowena" },
    content: `Arrived just now (${index + 1}): the ridge is ours.`,
    createdAt: new Date(Date.UTC(2026, 9, 18, 13, index)).toISOString(),
  } as WorldChatMessage);
};

/** The lab's player in chat: the lab session's account. */
const LAB_SELF = LAB_SESSION.user.realmsId as string;

/** A private conversation with another player: their lines and the lab player's, oldest first. */
const labThread = (
  other: string,
  lines: [mine: boolean, content: string, minute: number][],
  unreadCount: number,
): DirectMessageThreadState => {
  const id = `${LAB_SELF}|${other}`;
  return {
    thread: { id, participants: [LAB_SELF, other], createdAt: new Date(0).toISOString(), unreadCounts: {} },
    messages: lines.map(
      ([mine, content, minute], index): DirectMessage => ({
        id: `${id}-${index}`,
        threadId: id,
        senderId: mine ? LAB_SELF : other,
        recipientId: mine ? other : LAB_SELF,
        content,
        createdAt: new Date(Date.UTC(2026, 9, 18, 11, minute)).toISOString(),
      }),
    ),
    unreadCount,
    hasMoreHistory: false,
    lastFetchedCursor: undefined,
    isFetchingHistory: false,
    pendingMessages: [],
  };
};

/** Three of the room's players, by the seat identity names: Aldric and Corwin online, Isolde not. */
const [ALDRIC, CORWIN, ISOLDE] = [1, 2, 4].map((seat) => ROOM_PLAYERS[seat]!);

/** Three conversations: Aldric's unread, Isolde's (who is offline) read, Corwin's from the day before. */
const LAB_THREADS = [
  labThread(ALDRIC, [[false, "gg on the spire, merge armies tomorrow?", 50]], 1),
  labThread(
    ISOLDE,
    [
      [false, "deal, I take the camp", 30],
      [true, "and I clear the ruin after", 31],
    ],
    0,
  ),
  labThread(CORWIN, [[false, "thanks for the report", -600]], 0),
];

/**
 * The room the lab shows: connected, joined, its history loaded with unread messages, three private conversations, and
 * the store's network steps made to do nothing, so the page opens no socket and reads no history. `view` opens
 * Messages or Isolde's conversation, as the tabs and the list do.
 */
function installLabRoom(view: string | null): true {
  answerRoomProfiles();
  const { actions } = useRealtimeChatStore.getState();
  useRealtimeChatStore.setState({
    connectionStatus: "connected",
    identity: { playerId: LAB_SELF, displayName: "Maelis" },
    onlinePlayers: Object.fromEntries(
      [ALDRIC, CORWIN].map((playerId) => [
        playerId,
        { playerId, displayName: LAB_SEAT_PROFILES[playerId]!.name, isOnline: true, isTypingInThreadIds: [] },
      ]),
    ),
    dmThreads: Object.fromEntries(LAB_THREADS.map((thread) => [thread.thread.id, thread])),
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
    view: { kind: "room", zoneId: GLOBAL_CHAT_CHANNEL_ID },
    actions: {
      ...actions,
      initializeClient: () => undefined,
      resetClient: () => undefined,
      loadWorldHistory: () => Promise.resolve(),
      loadDirectHistory: () => Promise.resolve(),
      // What the lab's player sends comes back from the room as the room broadcasts it.
      sendWorldMessage: async (zoneId, { content }) => actions.receiveWorldMessage(zoneId, ownMessage(zoneId, content)),
    },
  });
  const { actions: lab } = useRealtimeChatStore.getState();
  if (view === "messages") lab.showMessages();
  if (view === "conversation") lab.openConversation(ISOLDE);
  return true;
}

let sent = 0;
const ownMessage = (zoneId: string, content: string) =>
  ({
    id: `lab-sent-${(sent += 1)}`,
    zoneId,
    sender: { playerId: LAB_SESSION.user.realmsId, displayName: LAB_SESSION.user.name },
    content,
    createdAt: new Date().toISOString(),
  }) as WorldChatMessage;
