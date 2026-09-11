import { afterEach, expect, it, vi } from "vitest";
import { useRealtimeChatStore } from "./store";

afterEach(() => {
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
  const load = () => useRealtimeChatStore.getState().actions.loadWorldHistory({ zoneId: "game:28", limit: 10 });
  await load();
  expect(useRealtimeChatStore.getState().worldZones["game:28"]).toMatchObject({
    isFetchingHistory: false,
    historyError: expect.any(String),
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
  await actions.loadWorldHistory({ zoneId: "game:28", limit: 10 });
  await actions.sendWorldMessage("game:28", { zoneId: "game:28", content: "hello" });
  expect(fetch).not.toHaveBeenCalled();
  expect(useRealtimeChatStore.getState().worldZones["game:28"]).toBeUndefined();
});
