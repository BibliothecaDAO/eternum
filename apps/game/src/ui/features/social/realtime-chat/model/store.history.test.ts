import { afterEach, expect, it, vi } from "vitest";
import { useRealtimeChatStore, WORLD_HISTORY_PAGE_LIMIT } from "./store";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";

afterEach(() => {
  useRealtimeChatStore.getState().actions.resetClient();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("reports a failed history load in the zone and clears it on explicit retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [], nextCursor: null }) });
  vi.stubGlobal("fetch", fetch);
  useRealtimeChatStore.setState({ baseUrl: "https://chat.test", joinedZoneIds: ["game:28"], worldZones: {} });
  const load = () =>
    useRealtimeChatStore.getState().actions.loadWorldHistory({ zoneId: "game:28", limit: WORLD_HISTORY_PAGE_LIMIT });
  await load();
  expect(useRealtimeChatStore.getState().worldZones["game:28"]).toMatchObject({
    isFetchingHistory: false,
    historyError: CHAT_WORDS.historyUnavailable,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  await load();
  expect(useRealtimeChatStore.getState().worldZones["game:28"].historyError).toBeUndefined();
});

it("does not request history or enqueue messages for a channel the server has not granted", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  useRealtimeChatStore.setState({ baseUrl: "https://chat.test", joinedZoneIds: ["game:7"], worldZones: {} });
  const actions = useRealtimeChatStore.getState().actions;
  actions.joinZone("game:28");
  await actions.loadWorldHistory({ zoneId: "game:28", limit: WORLD_HISTORY_PAGE_LIMIT });
  await actions.sendWorldMessage("game:28", { zoneId: "game:28", content: "hello" });
  expect(fetch).not.toHaveBeenCalled();
  expect(useRealtimeChatStore.getState().worldZones["game:28"]).toBeUndefined();
});

it("auto-loads the first page once when joining a granted zone and does not double-fetch on repeated joins", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      messages: [
        {
          id: "m1",
          zoneId: "game:28",
          content: "hello",
          createdAt: "2026-10-28T12:00:00.000Z",
          sender: { playerId: "0xa", displayName: "Ada" },
        },
      ],
      nextCursor: "older-cursor",
    }),
  });
  vi.stubGlobal("fetch", fetch);
  useRealtimeChatStore.setState({ baseUrl: "https://chat.test", joinedZoneIds: ["game:28"], worldZones: {} });

  const actions = useRealtimeChatStore.getState().actions;
  actions.joinZone("game:28");
  actions.joinZone("game:28");
  await vi.waitFor(() => {
    expect(useRealtimeChatStore.getState().worldZones["game:28"]?.isFetchingHistory).toBe(false);
  });

  actions.joinZone("game:28");
  actions.showRoom("game:28");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(WORLD_HISTORY_PAGE_LIMIT).toBe(50);
  expect(String(fetch.mock.calls[0]?.[0])).toContain("limit=50");
  expect(useRealtimeChatStore.getState().worldZones["game:28"]).toMatchObject({
    lastFetchedCursor: "older-cursor",
    hasMoreHistory: true,
  });
  expect(useRealtimeChatStore.getState().worldZones["game:28"]?.messages.map((m) => m.id)).toEqual(["m1"]);
});

it("ignores a late world history response after the client is reset", async () => {
  let resolveFetch!: (value: Response) => void;
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const client = { close: vi.fn() } as never;
  useRealtimeChatStore.setState({
    client,
    baseUrl: "https://chat.test",
    joinedZoneIds: ["game:28"],
    worldZones: {},
  });

  const pending = useRealtimeChatStore
    .getState()
    .actions.loadWorldHistory({ zoneId: "game:28", limit: WORLD_HISTORY_PAGE_LIMIT });
  useRealtimeChatStore.getState().actions.resetClient();
  resolveFetch(
    new Response(
      JSON.stringify({
        messages: [
          {
            id: "stale",
            zoneId: "game:28",
            content: "late",
            createdAt: "2026-10-28T12:00:00.000Z",
            sender: { playerId: "0xa", displayName: "Ada" },
          },
        ],
        nextCursor: null,
      }),
      { status: 200 },
    ),
  );
  await pending;

  expect(useRealtimeChatStore.getState().worldZones["game:28"]).toBeUndefined();
});

it("loads direct conversation history once on openConversation and does not double-fetch when opened again", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      messages: [
        {
          id: "d1",
          threadId: "0x7|0xa",
          senderId: "0xa",
          recipientId: "0x7",
          content: "ready",
          createdAt: "2026-10-28T12:00:00.000Z",
        },
      ],
      nextCursor: null,
    }),
  });
  vi.stubGlobal("fetch", fetch);
  useRealtimeChatStore.setState({
    baseUrl: "https://chat.test",
    identity: { playerId: "0x7", displayName: "You" },
    blockList: { blocked: [], version: 0 },
    dmThreads: {},
  });

  const actions = useRealtimeChatStore.getState().actions;
  actions.openConversation("0xa");
  actions.openConversation("0xa");
  await vi.waitFor(() => {
    expect(useRealtimeChatStore.getState().dmThreads["0x7|0xa"]?.isFetchingHistory).toBe(false);
  });

  actions.openConversation("0xa");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0]?.[0])).toContain("limit=50");
  expect(useRealtimeChatStore.getState().dmThreads["0x7|0xa"]?.messages.map((m) => m.id)).toEqual(["d1"]);
});
