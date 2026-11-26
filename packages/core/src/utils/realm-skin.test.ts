import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  equippedRealmSkin,
  holdsRealmSkin,
  REALM_SKIN_FAMILIES,
  realmShowsWonder,
  wornRealmSkinFamily,
} from "./realm-skin";

const { DEFAULT_REALM_SKIN, BASE_REALM_SKIN, SEASON_ONE_REALM_SKIN, WONDER_REALM_SKIN } = REALM_SKIN_FAMILIES;

const realm = (hasWonder: boolean) =>
  ({ game_id: 1, entity_id: 7n, metadata: { has_wonder: hasWonder } }) as Parameters<typeof realmShowsWonder>[1];
const storeWith = (family: number | undefined) => ({
  get: (model: string, key: { game_id: number; entity_id: bigint }) =>
    model === "RealmSkin" && key.game_id === 1 && key.entity_id === 7n && family !== undefined
      ? { game_id: 1, entity_id: 7n, family }
      : undefined,
});

describe("the families a realm holds, as the chain decides them", () => {
  it("matches the contract's vectors for every Seal, Aspect, Wonder and family", () => {
    const fields = readFileSync(
      new URL("../../../../contracts/l3/world-native/tests/fixtures/realm-skin-holds.txt", import.meta.url),
      "utf8",
    )
      .trim()
      .split(/\s+/)
      .map(Number);
    expect(fields).toHaveLength(200);
    while (fields.length) {
      const [seal, aspect, wonder, family, held] = fields.splice(0, 5) as number[];
      const holding = { sealHeld: seal === 1, aspect: aspect!, hasWonder: wonder === 1 };
      expect(holdsRealmSkin(holding, family!), `${seal} ${aspect} ${wonder} ${family}`).toBe(held === 1);
    }
  });
});

describe("the family a realm wears, which the game draws", () => {
  it("wears its Wonder by default when it holds one, else the base skin", () => {
    expect(wornRealmSkinFamily({ hasWonder: true }, DEFAULT_REALM_SKIN)).toBe(WONDER_REALM_SKIN);
    expect(wornRealmSkinFamily({ hasWonder: false }, DEFAULT_REALM_SKIN)).toBe(BASE_REALM_SKIN);
  });

  it("wears the family its owner equipped while it holds it and the game draws it, else the default", () => {
    expect(wornRealmSkinFamily({ hasWonder: true }, BASE_REALM_SKIN)).toBe(BASE_REALM_SKIN);
    expect(wornRealmSkinFamily({ hasWonder: false }, WONDER_REALM_SKIN)).toBe(BASE_REALM_SKIN);
    expect(wornRealmSkinFamily({ hasWonder: true }, SEASON_ONE_REALM_SKIN)).toBe(WONDER_REALM_SKIN);
  });

  it("reads the equipped family from the realm's RealmSkin row, the default order without one", () => {
    expect(equippedRealmSkin(storeWith(undefined) as never, realm(true))).toBe(DEFAULT_REALM_SKIN);
    expect(
      [undefined, BASE_REALM_SKIN, WONDER_REALM_SKIN].map((family) =>
        realmShowsWonder(storeWith(family) as never, realm(true)),
      ),
    ).toEqual([true, false, true]);
  });
});
