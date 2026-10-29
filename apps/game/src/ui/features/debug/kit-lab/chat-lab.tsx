import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useDocumentClass } from "@/hooks/use-document-class";
import { useGame } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getBlockTimestamp } from "@bibliothecadao/eternum";
import { LAB_GUARDIAN, LAB_SEAT_PROFILES, LAB_SESSION } from "@/shell/lab/app-lab-fixtures";
import { GUARDIAN_QUERY } from "@/shell/herald";
import { appQueryClient } from "@/runtime/query-client";
import { realmsAccountAddress } from "@realms-world/identity/account";
import { placeMetadata, sharedPlaceOf } from "@/ui/features/social/realtime-chat/model/place";
import { replyMetadata } from "@/ui/features/social/realtime-chat/model/reply";
import { setActiveGame } from "@/runtime/world/store";
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
import { GLOBAL_CHAT_CHANNEL_ID, TileOccupier } from "@bibliothecadao/types";
import { type ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { labGameProfile } from "./fixture-game";
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
              <LabPlaces select>
                <HudChatWindow open={open} onOpenChange={setOpen} foldToIcon={params.get("fold") === "1"} />
              </LabPlaces>
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

/**
 * Places in the room, as sharing makes them (sharedPlaceOf on the lab game's store, as the place button reads it):
 * message 32 carries the lab game's realm, 30 a Well on a tile beside it, 31 an army since gone (struck through) and 29
 * a realm of the same number in another game (named with its game, opening nothing here). With `select`, the realm
 * stands selected on the map, so the place button shares it; the rail keeps its picked army's tile.
 */
const LabPlaces = ({ select = false, children }: { select?: boolean; children: ReactNode }) => {
  const { store } = useGame().setup;
  useState(() => {
    const profile = labGameProfile(FRONTIER_PRESET);
    setActiveGame(profile);
    const game = { chainId: profile.chainId, gameId: profile.gameId, name: profile.name };
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: "0x1ee",
        value: {
          game_id: 1,
          alt: false,
          ...LAB_WELL,
          entity_id: 901,
          category: TileOccupier.Well,
          is_structure: false,
        },
      },
    ] as never);
    // Aldric's own realm, owned by his account as the guardian makes it from his Realms id: his card shows it.
    appQueryClient.setQueryData(GUARDIAN_QUERY.queryKey, LAB_GUARDIAN);
    const labRealm = store.require("Structure", { game_id: 1, entity_id: 7 });
    store.applyFacts([
      {
        model: "Structure",
        key: "0x2ad",
        value: JSON.parse(
          JSON.stringify(
            {
              ...labRealm,
              entity_id: ALDRIC_REALM,
              owner: realmsAccountAddress(ALDRIC, LAB_GUARDIAN.accountClassHash, LAB_GUARDIAN.publicKey),
              metadata: { ...labRealm.metadata, realm_id: 2 },
            },
            (_, field) => (typeof field === "bigint" ? field.toString() : field),
          ),
        ),
      },
    ] as never);
    const now = getBlockTimestamp().currentBlockTimestamp;
    const realm = sharedPlaceOf(store, game, LAB_REALM, false, now);
    const well = sharedPlaceOf(store, game, { kind: "hex", hex: LAB_WELL }, false, now);
    const gone = { kind: "army", entityId: 999, game, name: "Iron Wardens", icon: "knight-t2", at: 0 } as const;
    const elsewhere = { ...realm!, game: { chainId: "0x2b", gameId: 4, name: "Frontier 4" }, name: "Moondeep" };
    useRealtimeChatStore.setState((state) => {
      const zone = state.worldZones[GLOBAL_CHAT_CHANNEL_ID];
      if (!zone || !realm || !well) return state;
      const placed: Record<string, object> = {
        "lab-29": placeMetadata(elsewhere),
        "lab-30": placeMetadata(well),
        "lab-31": placeMetadata(gone),
        "lab-32": placeMetadata(realm),
      };
      const messages = zone.messages.map((message) =>
        placed[message.id] ? { ...message, metadata: { ...message.metadata, ...placed[message.id] } } : message,
      );
      return { worldZones: { ...state.worldZones, [GLOBAL_CHAT_CHANNEL_ID]: { ...zone, messages } } };
    });
    if (select) useUIStore.getState().selectOnMap(LAB_REALM);
  });
  return children;
};

/** The lab game's realm, as the map selects it; a Well on a tile of its own. */
const LAB_REALM = { kind: "structure" as const, entityId: 7 };
const LAB_WELL = { col: 12, row: 12 };
const ALDRIC_REALM = 77;
const FRONTIER_PRESET = 5;

const noop = () => undefined;

/**
 * The rail as the desktop HUD stacks it, over a canvas standing in for the map: what is always on (Next up, Events with
 * eleven unread), the real picked-army tile of the panels lab (`/lab/kit/panels?tile=army`), then chat; the build tag
 * in the band under the columns.
 */
const RailLab = ({ chatOpen }: { chatOpen: boolean }) => (
  <TileGame tile="army">
    <RoomPlayers>
      <LabPlaces>
        <RailStage chatOpen={chatOpen} />
      </LabPlaces>
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
  29: "on the other front:",
  30: "a Well here:",
  31: "yesterday's army is gone:",
  32: "meet me at",
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

/**
 * The servers chat reads, answered in the tab: identity's names for the room's players, as the identity Worker serves
 * them, and the account's block list, as the chat Worker keeps it. Anything else goes on.
 */
const answerChatServers = () => {
  const network = window.fetch.bind(window);
  // The account's block list, kept in the tab: Mute adds an account, Unmute takes it off, each answering the list.
  let blocked: string[] = [];
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.pathname.startsWith("/api/chat/blocks")) {
      if (init?.method === "POST")
        blocked = [...blocked, (JSON.parse(String(init.body)) as { realmsId: string }).realmsId];
      if (init?.method === "DELETE")
        blocked = blocked.filter((id) => id !== decodeURIComponent(url.pathname.split("/").at(-1)!));
      return Promise.resolve(Response.json({ blocked }));
    }
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
  unread: number,
): DirectMessageThreadState => {
  const id = `${LAB_SELF}|${other}`;
  return {
    thread: {
      id,
      participants: [LAB_SELF, other],
      createdAt: new Date(0).toISOString(),
      unreadCounts: { [LAB_SELF]: unread },
    },
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
  answerChatServers();
  const { actions } = useRealtimeChatStore.getState();
  useRealtimeChatStore.setState({
    connectionStatus: "connected",
    // The tab answers the chat server's block list here.
    baseUrl: window.location.origin,
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
    // Who is muted is known, as the server's list answers it: nobody yet.
    blockedPlayers: [],
    view: { kind: "room", zoneId: GLOBAL_CHAT_CHANNEL_ID },
    actions: {
      ...actions,
      initializeClient: () => undefined,
      resetClient: () => undefined,
      loadWorldHistory: () => Promise.resolve(),
      loadDirectHistory: () => Promise.resolve(),
      // What the lab's player sends comes back from the room as the room broadcasts it.
      sendWorldMessage: async (zoneId, { content, metadata }) =>
        actions.receiveWorldMessage(zoneId, ownMessage(zoneId, content, metadata)),
    },
  });
  const { actions: lab } = useRealtimeChatStore.getState();
  if (view === "messages") lab.showMessages();
  if (view === "conversation") lab.openConversation(ISOLDE);
  return true;
}

let sent = 0;
const ownMessage = (zoneId: string, content: string, metadata?: Readonly<Record<string, unknown>>) =>
  ({
    id: `lab-sent-${(sent += 1)}`,
    zoneId,
    sender: { playerId: LAB_SESSION.user.realmsId, displayName: LAB_SESSION.user.name },
    content,
    ...(metadata ? { metadata } : {}),
    createdAt: new Date().toISOString(),
  }) as WorldChatMessage;
