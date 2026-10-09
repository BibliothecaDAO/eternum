import { describe, expect, it } from "bun:test";
import { frontierPlayerFacts } from "./frontier";

describe("Frontier report facts", () => {
  it("keeps progress while excluding cyclic clients, game functions and device credentials from IPC", () => {
    const client: Record<string, unknown> = { subscribe: () => undefined };
    client.self = client;
    const player = {
      identity: { botId: 7, owner: "0xabc", privateKey: "test-only-device-key" },
      client,
      game: { submit: () => undefined },
      realmId: 9,
      profile: "daily",
      settledAt: 100,
      days: [{ epoch: 1, actions: 4 }],
      rungs: [],
      rollovers: [],
      captures: [],
      siteExchanges: new Map([[3, 2]]),
      nextActionAt: 101,
    } as unknown as Parameters<typeof frontierPlayerFacts>[0];
    const facts = frontierPlayerFacts(player);
    expect(facts).toMatchObject({ botId: 7, owner: "0xabc", realmId: 9, days: [{ epoch: 1, actions: 4 }] });
    expect(structuredClone(facts)).toEqual(facts);
    const serialized = JSON.stringify(facts);
    expect(serialized).not.toContain("test-only-device-key");
    for (const key of ["client", "game", "identity", "siteExchanges", "nextActionAt"])
      expect(Object.hasOwn(facts, key)).toBe(false);
  });
});
