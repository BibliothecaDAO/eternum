import { afterEach, expect, it, vi } from "vitest";
import { createEternumGame, fetchFactoryRuns, registerPlaytestSlot, retryFactoryRun } from "./factory-worker";
afterEach(() => vi.unstubAllGlobals());
it("sends free-slot and Eternum requests through the authenticated service", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetch);
  await registerPlaytestSlot("evening");
  await createEternumGame("long-game", "2099-01-02T12:00:00Z");
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/slots/evening/register", "/api/factory/runs"]);
  expect(fetch.mock.calls.every(([, init]) => init.credentials === "include" && init.method === "POST")).toBe(true);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
    environment: "madara.eternum",
    gameName: "long-game",
    gameStartTime: "2099-01-02T12:00:00Z",
    version: "3",
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
  expect(fetch.mock.calls[1][0]).toBe("/api/factory/results/madara.blitz/evening-1/actions/continue");
  fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "Launcher permission required" }) });
  await expect(createEternumGame("long-game", "2099-01-02T12:00:00Z")).rejects.toThrow("Launcher permission required");
});
