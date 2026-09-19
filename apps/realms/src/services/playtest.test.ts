import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: { VITE_PUBLIC_LAUNCH_SERVICE_URL: "https://launch.test/" } }));
import { PlaytestClient } from "./playtest";

const slot = { name: "evening", closesAt: "2026-09-19T18:00:00Z", frozenAt: null, closed: false, registrations: [] };
const run = <A, E>(effect: Effect.Effect<A, E, PlaytestClient>) =>
  Effect.runPromise(effect.pipe(Effect.provide(PlaytestClient.layer)));

describe("free playtest registration", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uses the identity cookie and sends no owner, payment or item options", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ ...slot, registrations: [{ owner: "0x1", position: 0, gameNumber: null }] }));
    vi.stubGlobal("fetch", fetch);
    const result = await run(Effect.flatMap(PlaytestClient, (client) => client.register("evening")));
    expect(result.registrations).toHaveLength(1);
    expect(fetch).toHaveBeenCalledExactlyOnceWith("https://launch.test/api/slots/evening/register", {
      credentials: "include",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  });
  it("retains closed, assigned and unassigned states from the service", async () => {
    const assigned = {
      ...slot,
      closed: true,
      frozenAt: slot.closesAt,
      registrations: [
        { owner: "0x1", position: 0, gameNumber: 1 },
        { owner: "0x2", position: 1, gameNumber: null },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ slots: [assigned] })));
    expect(await run(Effect.flatMap(PlaytestClient, (client) => client.slots))).toEqual([assigned]);
  });
  it("surfaces a closed-registration rejection without retrying", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: "Registration closed" }, { status: 409 }));
    vi.stubGlobal("fetch", fetch);
    await expect(run(Effect.flatMap(PlaytestClient, (client) => client.register("evening")))).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
