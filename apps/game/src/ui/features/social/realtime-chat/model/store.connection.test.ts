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

it("waits for the server handshake and only opens game zones the server granted", async () => {
  const actions = useRealtimeChatStore.getState().actions;
  actions.initializeClient({ baseUrl: "https://chat.test", joinZones: ["game:7", "game:28"] });
  mock.options!.onOpen!({} as WebSocket);
  expect(useRealtimeChatStore.getState().connectionStatus).toBe("connecting");
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual([]);
  expect(mock.joinZone).not.toHaveBeenCalled();

  await actions.sendWorldMessage("game:28", { zoneId: "game:28", content: "hello" });
  expect(mock.send).not.toHaveBeenCalled();
  expect(useRealtimeChatStore.getState().worldZones["game:28"]).toBeUndefined();

  mock.options!.onMessage!({ type: "connected", playerId: "0xa", channels: ["game:7"] }, {} as MessageEvent);
  expect(useRealtimeChatStore.getState().connectionStatus).toBe("connected");
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual(["game:7"]);
  expect(useRealtimeChatStore.getState().worldZones["game:7"]).toBeDefined();
  expect(useRealtimeChatStore.getState().worldZones["game:28"]).toBeUndefined();
  expect(mock.joinZone).not.toHaveBeenCalled();

  await actions.sendWorldMessage("game:28", { zoneId: "game:28", content: "still denied" });
  expect(mock.send).not.toHaveBeenCalled();

  mock.options!.onClose!({ wasClean: true } as CloseEvent);
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual([]);
});

it("ignores delayed connection events from a replaced client", () => {
  const actions = useRealtimeChatStore.getState().actions;
  actions.initializeClient({ baseUrl: "https://chat.test", joinZones: ["game:7"] });
  const previous = mock.options!;
  actions.initializeClient({ baseUrl: "https://chat.test", joinZones: ["game:28"] });
  mock.options!.onMessage!({ type: "connected", playerId: "0xb", channels: ["game:28"] }, {} as MessageEvent);

  previous.onMessage!({ type: "connected", playerId: "0xa", channels: ["game:7"] }, {} as MessageEvent);
  previous.onClose!({ wasClean: true } as CloseEvent);
  expect(useRealtimeChatStore.getState().connectionStatus).toBe("connected");
  expect(useRealtimeChatStore.getState().joinedZoneIds).toEqual(["game:28"]);
  expect(useRealtimeChatStore.getState().identity?.playerId).toBe("0xb");
});
