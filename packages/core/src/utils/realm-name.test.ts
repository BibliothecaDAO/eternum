import { describe, expect, it, vi } from "vitest";
import { realmName, StructureType } from "@bibliothecadao/types";
import names from "../data/realm-names.json";
import { getStructureName } from "./entities";
import { NativeFactStore } from "../client/native-fact-store";
vi.stubGlobal("localStorage", { getItem: () => null });

const home = {
  game_id: 1,
  entity_id: 7n,
  owner: 1n,
  base: { category: StructureType.Realm },
  metadata: { realm_id: 1, has_wonder: false },
} as never;
const storeFor = (release: number, settledHome?: bigint) => {
  const store = new NativeFactStore();
  store.applyFacts([
    { model: "GameRelease", key: "1", value: { game_id: 1, release_id: release, preset_commitment: 1n } },
    ...(settledHome === undefined
      ? []
      : [{ model: "SettledRealm", key: "1:1", value: { game_id: 1, realm_id: 1, home: settledHome } }]),
  ] as never);
  return store;
};

describe("Realm identity", () => {
  it("excludes every canonical name from every generated combination", () => {
    const canonical = new Set(Object.values(names).map((name) => name.toLowerCase()));
    const generated = new Set(Array.from({ length: 100_000 }, (_, id) => realmName(id)));
    expect(generated.size).toBe(1024);
    for (const name of generated) {
      expect(name).toMatch(/^[A-Z][a-z]+$/);
      expect(canonical.has(name.toLowerCase())).toBe(false);
    }
    expect(realmName(7)).toBe("Temtinos");
    expect(realmName(2 ** 32 + 7)).toBe("Emilshanel");
  });
  it("keeps running games' names, and names only a proven held home canonically in release 3", () => {
    expect(getStructureName(home, storeFor(2)).name).toBe("Stolsli");
    expect(getStructureName(home, storeFor(3, 7n)).name).toBe("Stolsli");
    expect(getStructureName(home, storeFor(3)).name).toBe(realmName(7));
    expect(getStructureName(home, storeFor(3, 8n)).name).toBe(realmName(7));
  });
});
