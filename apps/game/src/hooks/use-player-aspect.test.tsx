import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aspects, GLOBAL_CHAT_CHANNEL_ID, StructureType } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { aspectVariables } from "@/tokens";
import { layOutChatLists } from "@/hooks/use-stick-to-latest.test-support";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";

const SELF_ID = "0x100";
const ALDRIC_ID = "0x200";
const CORWIN_ID = "0x300";
const UNKNOWN_ID = "0x400";

const SELF_ACCOUNT = "0x1100";
const ALDRIC_ACCOUNT = "0x2200";
const CORWIN_ACCOUNT = "0x3300";
const UNKNOWN_ACCOUNT = "0x4400";

const REALMS_TO_ACCOUNT: Record<string, string> = {
  [SELF_ID]: SELF_ACCOUNT,
  [ALDRIC_ID]: ALDRIC_ACCOUNT,
  [CORWIN_ID]: CORWIN_ACCOUNT,
  [UNKNOWN_ID]: UNKNOWN_ACCOUNT,
};

const fixture = vi.hoisted(() => ({ store: null as unknown as NativeFactStore }));

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: fixture.store } }),
}));
vi.mock("@/shell/herald", () => ({
  useRealmsAccountOf: () => (realmsId: string) => REALMS_TO_ACCOUNT[realmsId] ?? null,
}));
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayers: () => [],
  usePlayerNames: () => ({
    reading: (account: string) => ({ state: "named" as const, claimed: false, text: account }),
    profile: () => ({ known: false, portrait: null }),
  }),
}));
vi.mock("@/ui/features/social/realtime-chat/hooks/use-chat-mentions", () => ({
  useChatMentions: () => ({ me: null, choices: [], names: [] }),
}));
vi.mock("@/runtime/world/store", () => ({
  getActiveGame: () => ({ chainId: "0x1", gameId: 1, name: "Frontier 1" }),
}));

const { playerAspectOf, readPlayerAspects } = await import("./use-player-aspect");
const { GLOBAL_ROOM } = await import("@/ui/features/social/realtime-chat/model/chat-rooms");
const { useRealtimeChatStore } = await import("@/ui/features/social/realtime-chat/model/store");
const { GameChatMap } = await import("@/ui/features/social/realtime-chat/ui/shared/chat-map");
const { useGamePlayerAspect } = await import("@/ui/features/social/realtime-chat/ui/shared/use-chat-map");
const { RealtimeChatShell } = await import("@/ui/features/social/realtime-chat/ui/realtime-chat-shell");
const { useChatStrip } = await import("@/ui/features/social/realtime-chat/ui/chat-dock");

const realmRow = (entityId: number, owner: string) => ({
  model: "Structure",
  key: `0x1:${entityId}`,
  value: {
    game_id: 1,
    entity_id: entityId,
    owner,
    base: {
      troop_max_guard_count: 1,
      troop_max_explorer_count: 1,
      created_at: 1,
      category: StructureType.Realm,
      level: 0,
      starting_troops_granted: true,
    },
    resources_packed: "0",
    metadata: { realm_id: entityId, order: 1, has_wonder: false, village_realm: 0, mine_kind: 0, deepest_depth: 0 },
  },
});

const aspectRow = (home: number, aspect: number) => ({
  model: "HomeAspect",
  key: `0x1:${home}`,
  value: { game_id: 1, home, aspect },
});

describe("readPlayerAspects and playerAspectOf", () => {
  it("maps every catalog Aspect from NativeFactStore Structure and HomeAspect rows without network reads", () => {
    const store = new NativeFactStore();
    store.applyFacts([
      ...aspects.flatMap(({ id }, index) => [
        realmRow(10 + index, `0x${(0x500 + index).toString(16)}`),
        aspectRow(10 + index, id),
      ]),
      realmRow(99, "0x0"),
      aspectRow(99, 1),
    ] as never);

    const map = readPlayerAspects(store, 1);
    for (const [index, aspect] of aspects.entries()) {
      expect(playerAspectOf(map, `0x${(0x500 + index).toString(16)}`)).toBe(aspect.id);
    }
    expect(playerAspectOf(map, "0x0")).toBeNull();
    expect(playerAspectOf(map, "0x999")).toBeNull();
    expect(playerAspectOf(map, "")).toBeNull();
    expect(playerAspectOf(map, "not-a-felt")).toBeNull();
    expect(playerAspectOf(map, null)).toBeNull();
  });

  it("throws when a HomeAspect row carries an aspect id outside the catalog", () => {
    const store = new NativeFactStore();
    store.applyFacts([realmRow(10, SELF_ACCOUNT), aspectRow(10, 99)] as never);
    expect(() => readPlayerAspects(store, 1)).toThrow("Unknown Aspect 99");
  });
});

describe("realtime chat Aspect username colors via NativeFactStore", () => {
  let host: HTMLDivElement;
  let root: Root;
  let undoLayout: () => void;
  const fetchSpy = vi.fn();

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    undoLayout = layOutChatLists();
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
    fixture.store = frontierDay().store;
    configManager.setActiveGame(1);
    configManager.setStore(fixture.store);
    fixture.store.applyFacts([
      realmRow(101, SELF_ACCOUNT),
      aspectRow(101, 2),
      realmRow(102, ALDRIC_ACCOUNT),
      aspectRow(102, 1),
      realmRow(103, CORWIN_ACCOUNT),
      aspectRow(103, 3),
    ] as never);

    const threadId = `${SELF_ID}|${ALDRIC_ID}`;
    const { actions } = useRealtimeChatStore.getState();
    useRealtimeChatStore.setState({
      connectionStatus: "connected",
      blockList: { blocked: [CORWIN_ID], version: 1 },
      identity: { playerId: SELF_ID, displayName: "You" },
      joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID],
      activeZoneId: GLOBAL_CHAT_CHANNEL_ID,
      activeThreadId: undefined,
      worldZones: {
        [GLOBAL_CHAT_CHANNEL_ID]: {
          zoneId: GLOBAL_CHAT_CHANNEL_ID,
          messages: [
            {
              id: "m1",
              zoneId: GLOBAL_CHAT_CHANNEL_ID,
              sender: { playerId: ALDRIC_ID, displayName: "Aldric" },
              content: "holding the pass",
              createdAt: "2026-10-28T12:00:00.000Z",
            },
            {
              id: "m2",
              zoneId: GLOBAL_CHAT_CHANNEL_ID,
              sender: { playerId: UNKNOWN_ID, displayName: "Wanderer" },
              content: "no realm yet",
              createdAt: "2026-10-28T12:01:00.000Z",
              metadata: { replyTo: { id: "m1", playerId: ALDRIC_ID, excerpt: "holding the pass" } },
            },
          ],
          unreadCount: 0,
          hasMoreHistory: false,
          lastFetchedCursor: null,
          isFetchingHistory: false,
          pendingMessages: [],
        },
      },
      dmThreads: {
        [threadId]: {
          thread: {
            id: threadId,
            participants: [SELF_ID, ALDRIC_ID],
            createdAt: new Date(0).toISOString(),
            unreadCounts: {},
          },
          messages: [
            {
              id: "d1",
              threadId,
              senderId: ALDRIC_ID,
              recipientId: SELF_ID,
              content: "ready at dawn",
              createdAt: "2026-10-28T12:05:00.000Z",
            },
            {
              id: "d2",
              threadId,
              senderId: SELF_ID,
              recipientId: ALDRIC_ID,
              content: "on my way",
              createdAt: "2026-10-28T12:06:00.000Z",
              metadata: { replyTo: { id: "d1", playerId: ALDRIC_ID, excerpt: "ready at dawn" } },
            },
          ],
          hasMoreHistory: false,
          lastFetchedCursor: undefined,
          isFetchingHistory: false,
          pendingMessages: [],
        },
      },
      onlinePlayers: {
        [ALDRIC_ID]: { playerId: ALDRIC_ID, displayName: "Aldric", isOnline: true, isTypingInThreadIds: [] },
        [CORWIN_ID]: { playerId: CORWIN_ID, displayName: "Corwin", isOnline: true, isTypingInThreadIds: [] },
      },
      view: { kind: "room", zoneId: GLOBAL_CHAT_CHANNEL_ID },
      actions: {
        ...actions,
        initializeClient: () => undefined,
        resetClient: () => undefined,
        loadWorldHistory: () => Promise.resolve(),
        loadDirectHistory: () => Promise.resolve(),
        sendWorldMessage: () => Promise.resolve(),
        sendDirectMessage: () => Promise.resolve(),
      },
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    undoLayout();
    vi.unstubAllGlobals();
  });

  it("colors Global, DM, Messages list, PlayerCard, and strip usernames by NativeFactStore Aspect with zero network fetches", () => {
    const StripPreview = () => {
      const aspectOf = useGamePlayerAspect();
      const { stripLine } = useChatStrip({
        zoneId: GLOBAL_CHAT_CHANNEL_ID,
        signedIn: true,
        readPlace: (place) => place.name,
        aspectOf,
      });
      return <div data-strip-preview>{stripLine}</div>;
    };

    act(() =>
      root.render(
        <GameChatMap>
          <StripPreview />
          <RealtimeChatShell rooms={[GLOBAL_ROOM]} />
        </GameChatMap>,
      ),
    );

    const m1Name = host.querySelector<HTMLElement>('li[data-message-id="m1"] p .ui-aspect-name')!;
    expect(m1Name.textContent).toBe("Aldric");
    expect(m1Name.getAttribute("data-aspect")).toBe("1");
    expect(m1Name.style.getPropertyValue("--hud-aspect")).toBe(aspectVariables(1)["--hud-aspect"]);

    const m2Name = host.querySelector<HTMLElement>('li[data-message-id="m2"] p .ui-aspect-name')!;
    expect(m2Name.textContent).toBe("Wanderer");
    expect(m2Name.hasAttribute("data-aspect")).toBe(false);

    const m2QuoteName = host.querySelector<HTMLElement>('li[data-message-id="m2"] > div > button .ui-aspect-name')!;
    expect(m2QuoteName.textContent).toBe("Aldric");
    expect(m2QuoteName.getAttribute("data-aspect")).toBe("1");

    act(() => host.querySelector<HTMLButtonElement>('li[data-message-id="m1"] p button')!.click());
    const cardName = host.querySelector<HTMLElement>(`[data-player-card="${ALDRIC_ID}"] .ui-aspect-name`)!;
    expect(cardName.textContent).toBe("Aldric");
    expect(cardName.getAttribute("data-aspect")).toBe("1");

    act(() => {
      fixture.store.applyFacts([realmRow(104, UNKNOWN_ACCOUNT), aspectRow(104, 4)] as never);
    });
    expect(
      host.querySelector<HTMLElement>('li[data-message-id="m2"] p .ui-aspect-name')!.getAttribute("data-aspect"),
    ).toBe("4");
    expect(host.querySelector<HTMLElement>("[data-strip-preview] .ui-aspect-name")!.getAttribute("data-aspect")).toBe(
      "4",
    );

    act(() => useRealtimeChatStore.getState().actions.openConversation(ALDRIC_ID));
    const dmHeader = host.querySelector<HTMLElement>("header .ui-aspect-name")!;
    expect(dmHeader.textContent).toBe("Aldric");
    expect(dmHeader.getAttribute("data-aspect")).toBe("1");

    const d1Name = host.querySelector<HTMLElement>('li[data-message-id="d1"] p .ui-aspect-name')!;
    expect(d1Name.getAttribute("data-aspect")).toBe("1");
    const d2Name = host.querySelector<HTMLElement>('li[data-message-id="d2"] p .ui-aspect-name')!;
    expect(d2Name.textContent).toBe("You");
    expect(d2Name.getAttribute("data-aspect")).toBe("2");
    const d2Quote = host.querySelector<HTMLElement>('li[data-message-id="d2"] > div > button .ui-aspect-name')!;
    expect(d2Quote.getAttribute("data-aspect")).toBe("1");

    act(() => useRealtimeChatStore.getState().actions.showMessages());
    const listNames = [...host.querySelectorAll<HTMLElement>(".ui-row .ui-aspect-name")].map((node) => [
      node.textContent,
      node.getAttribute("data-aspect"),
    ]);
    expect(listNames).toEqual([
      ["Aldric", "1"],
      ["Corwin", "3"],
    ]);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
