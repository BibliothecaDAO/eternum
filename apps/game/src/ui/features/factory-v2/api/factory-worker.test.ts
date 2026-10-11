import { afterEach, expect, it, vi } from "vitest";
import { createEternumGame, fetchFactoryRuns, retryFactoryRun } from "./factory-worker";
afterEach(() => vi.unstubAllGlobals());
it("sends Eternum requests through the authenticated service", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetch);
  await createEternumGame("long-game", "2099-01-02T12:00:00Z");
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/factory/runs"]);
  expect(fetch.mock.calls.every(([, init]) => init.credentials === "include" && init.method === "POST")).toBe(true);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    environment: "madara.eternum",
    gameName: "long-game",
    gameStartTime: "2099-01-02T12:00:00Z",
    version: "3",
    devModeOn: false,
  });
});
it("continues a failed game run and surfaces service errors", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ runs: [] }) });
  vi.stubGlobal("fetch", fetch);
  await fetchFactoryRuns();
  expect(fetch.mock.calls[0][0]).toBe("/api/factory/runs?environment=madara.eternum");
  await retryFactoryRun({ kind: "game", environment: "madara.eternum", gameName: "long-game" } as Parameters<
    typeof retryFactoryRun
  >[0]);
  expect(fetch.mock.calls[1][0]).toBe("/api/factory/runs/madara.eternum/long-game/actions/continue");
  fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "Launcher permission required" }) });
  await expect(createEternumGame("long-game", "2099-01-02T12:00:00Z")).rejects.toThrow("Launcher permission required");
});
