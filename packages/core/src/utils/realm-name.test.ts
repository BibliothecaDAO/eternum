import { describe, expect, it, vi } from "vitest";
import { realmName, StructureType } from "@bibliothecadao/types";
import metadata from "../data/canonical-realms.json";
import { getStructureName } from "./entities";
import { NativeFactStore } from "../client/native-fact-store";
import { advanceGames } from "../../../../apps/launch-service/src/release";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
vi.stubGlobal("localStorage", { getItem: () => null });

const home: NativeRows["Structure"] = {
  game_id: 1,
  entity_id: 7n,
  owner: 1n,
  base: {
    category: StructureType.Realm,
    level: 1,
    created_at: 0,
    troop_max_guard_count: 4,
    troop_max_explorer_count: 4,
    starting_troops_granted: true,
  },
  metadata: { realm_id: 1, order: 0, has_wonder: false, village_realm: 0n, mine_kind: 0, deepest_depth: 0 },
  resources_packed: 0n,
};
const storeFor = (release: number, settledHome?: bigint) => {
  const store = new NativeFactStore();
  store.applyFacts([
    {
      model: "GameRelease",
      key: "1",
      value: { game_id: 1, release_id: release, preset_commitment: 1n, created_release_id: release },
    },
    ...(settledHome === undefined
      ? []
      : [{ model: "SettledRealm", key: "1:1", value: { game_id: 1, realm_id: 1, home: settledHome } }]),
  ]);
  return store;
};

describe("Realm identity", () => {
  it("excludes every canonical name from every generated combination", () => {
    const canonical = new Set(metadata.realms.map(([name]) => String(name).toLowerCase()));
    const generated = new Set(Array.from({ length: 100_000 }, (_, id) => realmName(id)));
    expect(generated.size).toBe(1024);
    for (const name of generated) {
      expect(name).toMatch(/^[A-Z][a-z]+$/);
      expect(canonical.has(name.toLowerCase())).toBe(false);
    }
    expect(realmName(7)).toBe("Temtinos");
    expect(realmName(2 ** 32 + 7)).toBe("Emilshanel");
  });
  it("names only a proven held home canonically in games created from release 3", () => {
    expect(getStructureName(home, storeFor(2)).name).toBe("Stolsli");
    expect(getStructureName(home, storeFor(3, 7n)).name).toBe("Stolsli");
    expect(getStructureName(home, storeFor(3)).name).toBe(realmName(7));
    expect(getStructureName(home, storeFor(3, 8n)).name).toBe(realmName(7));
  });
  it.each([0, 2])(
    "preserves an existing game's names through deploy advances (creation release %s)",
    async (created) => {
      const store = storeFor(created);
      const writeRelease = (game_id: number, release_id: number, created_release_id: number) =>
        store.applyFacts([
          {
            model: "GameRelease",
            key: String(game_id),
            value: { game_id, release_id, created_release_id, preset_commitment: 1n },
          },
        ]);
      writeRelease(1, 2, created);
      expect(getStructureName(home, store).name).toBe("Stolsli");
      const nextHome = { ...home, game_id: 2 };
      writeRelease(2, 3, 3);
      expect(getStructureName(nextHome, store).name).toBe("Temtinos");
      const logic = { entry: "0x1" };
      const schema = "a".repeat(64);
      const applyRelease = vi.fn(async (game_id: number, release_id: number) => {
        const origin = store.require("GameRelease", { game_id }).created_release_id;
        writeRelease(game_id, release_id, origin);
        return "0x123";
      });
      const result = await advanceGames(
        {
          currentRelease: async () => 4,
          registeredRelease: async () => ({ logic, migration: "0x0" }),
          gameId: async (name) => (name === "running" ? 1 : 2),
          gameRelease: async (game_id) => store.require("GameRelease", { game_id }).release_id,
          isSettled: async () => false,
          applyRelease,
        },
        { releaseSchemas: { "2": schema, "3": schema, "4": schema } },
        { releaseId: 4, schema, logic, migration: "0x0" },
        ["running", "next-season"],
      );
      expect(applyRelease.mock.calls).toEqual([
        [1, 3],
        [1, 4],
        [2, 4],
      ]);
      expect(result).toEqual([
        { gameId: 1, from: 2, to: 4, transactions: ["0x123", "0x123"] },
        { gameId: 2, from: 3, to: 4, transactions: ["0x123"] },
      ]);
      expect(getStructureName(home, store).name).toBe("Stolsli");
      expect(getStructureName(nextHome, store).name).toBe("Temtinos");
    },
  );
});
