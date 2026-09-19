import { afterEach, expect, it, vi } from "vitest";
import {
  closePlaytestSlot,
  createEternumGame,
  createPlaytestSlot,
  fetchFactoryRuns,
  registerPlaytestSlot,
  retryFactoryRun,
} from "./factory-worker";
vi.mock("../../../../../env", () => ({ env: { VITE_PUBLIC_LAUNCH_SERVICE_URL: "https://launch.test/" } }));
afterEach(() => vi.unstubAllGlobals());
it("sends free-slot and Eternum requests through the authenticated service", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetch);
  await createPlaytestSlot("evening", "2099-01-01T12:00:00Z");
  await registerPlaytestSlot("evening");
  await closePlaytestSlot("evening");
  await createEternumGame("long-game", "2099-01-02T12:00:00Z");
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "https://launch.test/api/slots",
    "https://launch.test/api/slots/evening/register",
    "https://launch.test/api/slots/evening/close",
    "https://launch.test/api/factory/runs",
  ]);
  expect(fetch.mock.calls.every(([, init]) => init.credentials === "include" && init.method === "POST")).toBe(true);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ name: "evening", closesAt: "2099-01-01T12:00:00Z" });
  expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({
    environment: "madara.eternum",
    gameName: "long-game",
    gameStartTime: "2099-01-02T12:00:00Z",
    version: "1",
    devModeOn: false,
  });
});
it("retries finalization separately from creation and surfaces service errors", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ runs: [] }) });
  vi.stubGlobal("fetch", fetch);
  await fetchFactoryRuns("madara.blitz");
  await retryFactoryRun({ kind: "result", environment: "madara.blitz", gameName: "evening-1" } as Parameters<
    typeof retryFactoryRun
  >[0]);
  expect(fetch.mock.calls[1][0]).toBe(
    "https://launch.test/api/factory/results/madara.blitz/evening-1/actions/continue",
  );
  fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "Launcher permission required" }) });
  await expect(createPlaytestSlot("evening", "2099-01-01T12:00:00Z")).rejects.toThrow("Launcher permission required");
});
