import { afterEach, expect, it, vi } from "vitest";
import type { RealtimeClientOptions } from "@bibliothecadao/types";

const mock = vi.hoisted(() => ({
  options: undefined as RealtimeClientOptions | undefined,
  close: vi.fn(),
  joinZone: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@bibliothecadao/types", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/types")>()),
  RealtimeClient: class {
    constructor(options: RealtimeClientOptions) {
      mock.options = options;
    }
    close = mock.close;
    joinZone = mock.joinZone;
    send = mock.send;
  },
}));

import { useRealtimeChatStore } from "./store";

afterEach(() => {
  useRealtimeChatStore.getState().actions.resetClient();
  vi.clearAllMocks();
});

it("waits for the server handshake, and takes a room as joined when that room says so, whatever its inbox does", async () => {
  const actions = useRealtimeChatStore.getState().actions;
  actions.initializeClient({ baseUrl: "https://chat.test", rooms: ["game:7", "game:28"] });
  expect(mock.options!.rooms).toEqual(["game:7", "game:28"]);
  mock.options!.onOpen!({} as WebSocket);
  expect(useRealtimeChatStore.getState().connectionStatus).toBe("connecting");
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual([]);
  expect(mock.joinZone).not.toHaveBeenCalled();

  await actions.sendWorldMessage("game:28", { zoneId: "game:28", content: "hello" });
  expect(mock.send).not.toHaveBeenCalled();
  expect(useRealtimeChatStore.getState().worldZones["game:28"]).toBeUndefined();

  mock.options!.onMessage!({ type: "connected", playerId: "0xa", channels: ["game:7"] }, {} as MessageEvent);
  expect(useRealtimeChatStore.getState().connectionStatus).toBe("connected");
  // The handshake names what the account may read; the transport opens those rooms, each joined once it says so.
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual([]);
  mock.options!.onMessage!({ type: "joined:zone", zoneId: "game:7", canWrite: true }, {} as MessageEvent);
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual(["game:7"]);
  expect(useRealtimeChatStore.getState().worldZones["game:7"]).toBeDefined();
  expect(useRealtimeChatStore.getState().worldZones["game:28"]).toBeUndefined();
  expect(mock.joinZone).not.toHaveBeenCalled();

  await actions.sendWorldMessage("game:28", { zoneId: "game:28", content: "still denied" });
  expect(mock.send).not.toHaveBeenCalled();

  // The inbox closing, opening again and greeting again leaves the room, whose socket stands, joined.
  mock.options!.onClose!({ wasClean: false } as CloseEvent);
  mock.options!.onOpen!({} as WebSocket);
  mock.options!.onMessage!({ type: "connected", playerId: "0xa", channels: [] }, {} as MessageEvent);
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual(["game:7"]);
  // The room's own close leaves it.
  mock.options!.onMessage!({ type: "left:zone", zoneId: "game:7" }, {} as MessageEvent);
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual([]);
});

it("ignores delayed connection events from a replaced client", () => {
  const actions = useRealtimeChatStore.getState().actions;
  actions.initializeClient({ baseUrl: "https://chat.test", rooms: ["game:7"] });
  const previous = mock.options!;
  actions.initializeClient({ baseUrl: "https://chat.test", rooms: ["game:28"] });
  mock.options!.onMessage!({ type: "connected", playerId: "0xb", channels: ["game:28"] }, {} as MessageEvent);
  mock.options!.onMessage!({ type: "joined:zone", zoneId: "game:28", canWrite: true }, {} as MessageEvent);

  previous.onMessage!({ type: "connected", playerId: "0xa", channels: ["game:7"] }, {} as MessageEvent);
  previous.onClose!({ wasClean: true } as CloseEvent);
  expect(useRealtimeChatStore.getState().connectionStatus).toBe("connected");
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual(["game:28"]);
  expect(useRealtimeChatStore.getState().identity?.playerId).toBe("0xb");
});

it("reads as reconnecting while a dropped socket is coming back, and as connected once its room rejoins", () => {
  const actions = useRealtimeChatStore.getState().actions;
  actions.initializeClient({ baseUrl: "https://chat.test", rooms: ["world:global"] });
  mock.options!.onMessage!({ type: "connected", playerId: "0xa", channels: ["world:global"] }, {} as MessageEvent);
  mock.options!.onMessage!({ type: "joined:zone", zoneId: "world:global", canWrite: true }, {} as MessageEvent);

  // The room drops: the client reports it left, then that it is opening it again.
  mock.options!.onMessage!({ type: "left:zone", zoneId: "world:global" }, {} as MessageEvent);
  mock.options!.onReconnecting!();
  expect(useRealtimeChatStore.getState().connectionStatus).toBe("reconnecting");
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual([]);

  mock.options!.onMessage!({ type: "joined:zone", zoneId: "world:global" }, {} as MessageEvent);
  expect(useRealtimeChatStore.getState().connectionStatus).toBe("connected");
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual(["world:global"]);

  // The inbox drops: its close is told first, then the reconnecting, which is what the player reads.
  mock.options!.onClose!({ wasClean: false } as CloseEvent);
  mock.options!.onReconnecting!();
  expect(useRealtimeChatStore.getState().connectionStatus).toBe("reconnecting");
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual(["world:global"]);
});

it("joins only the rooms the player has: a game the account may read but is not shown never counts unread", () => {
  const actions = useRealtimeChatStore.getState().actions;
  actions.initializeClient({ baseUrl: "https://chat.test", rooms: ["world:global"] });
  mock.options!.onMessage!(
    { type: "connected", playerId: "0xa", channels: ["world:global", "game:7", "game:9"] },
    {} as MessageEvent,
  );
  // The transport opens only the player's room, which says so.
  mock.options!.onMessage!({ type: "joined:zone", zoneId: "world:global", canWrite: true }, {} as MessageEvent);
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual(["world:global"]);
  expect(Object.keys(useRealtimeChatStore.getState().worldZones)).toEqual(["world:global"]);
  mock.options!.onMessage!(
    {
      type: "world:message",
      zoneId: "game:7",
      message: {
        id: "m1",
        zoneId: "game:7",
        sender: { playerId: "0xb" },
        content: "hi",
        createdAt: "2026-10-28T12:00:00Z",
      },
    },
    {} as MessageEvent,
  );
  expect(useRealtimeChatStore.getState().unreadWorldTotal).toBe(0);
  expect(useRealtimeChatStore.getState().worldZones["game:7"]).toBeUndefined();
});
