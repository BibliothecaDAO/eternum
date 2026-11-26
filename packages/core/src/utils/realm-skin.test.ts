import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  equippedRealmSkin,
  holdsRealmSkin,
  REALM_SKIN_FAMILIES,
  realmShowsWonder,
  realmWornSkinFamily,
  showsWonder,
  wornRealmSkinFamily,
} from "./realm-skin";

const { DEFAULT_REALM_SKIN, BASE_REALM_SKIN, SEASON_ONE_REALM_SKIN, WONDER_REALM_SKIN } = REALM_SKIN_FAMILIES;

const realm = (hasWonder: boolean, level = 0, order = 1) =>
  ({
    game_id: 1,
    entity_id: 7n,
    owner: 99n,
    base: { level },
    metadata: { has_wonder: hasWonder, order },
  }) as Parameters<typeof realmShowsWonder>[1];
const holding = (hasWonder: boolean, sealHeld = false, aspect: number | null = null) => ({
  hasWonder,
  sealHeld,
  aspect,
});
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
    expect(wornRealmSkinFamily(holding(true), DEFAULT_REALM_SKIN)).toBe(WONDER_REALM_SKIN);
    expect(wornRealmSkinFamily(holding(false), DEFAULT_REALM_SKIN)).toBe(BASE_REALM_SKIN);
  });

  it("wears the family its owner equipped while it holds it and the game draws it, else the default", () => {
    expect(wornRealmSkinFamily(holding(true), BASE_REALM_SKIN)).toBe(BASE_REALM_SKIN);
    expect(wornRealmSkinFamily(holding(false), WONDER_REALM_SKIN)).toBe(BASE_REALM_SKIN);
    expect(wornRealmSkinFamily(holding(true), SEASON_ONE_REALM_SKIN)).toBe(WONDER_REALM_SKIN);
  });

  it("reads the equipped family from the realm's RealmSkin row, the default order without one", () => {
    expect(equippedRealmSkin(storeWith(undefined) as never, realm(true))).toBe(DEFAULT_REALM_SKIN);
    expect(
      [undefined, BASE_REALM_SKIN, WONDER_REALM_SKIN].map((family) =>
        realmShowsWonder(storeWith(family) as never, realm(true)),
      ),
    ).toEqual([true, false, true]);
  });

  it("resolves Season 1 at Settlement, City, and Kingdom only while the Seal and Aspect are held, falling back at Empire or when the Seal is lost", () => {
    const settlement = realm(false, 0, 1);
    const city = realm(false, 1, 1);
    const kingdom = realm(false, 2, 1);
    const wonderSettlement = realm(true, 0, 3);
    const wonderCity = realm(true, 1, 3);
    const wonderKingdom = realm(true, 2, 3);
    const wonderEmpire = realm(true, 3, 3);
    const storeFor = (family: number | undefined, hasSeal: boolean) => ({
      get: (model: string, key: { game_id: number; entity_id?: bigint; account?: bigint }) => {
        if (model === "RealmSkin" && key.game_id === 1 && key.entity_id === 7n && family !== undefined) {
          return { game_id: 1, entity_id: 7n, family };
        }
        if (model === "Seal" && key.game_id === 1 && key.account === 99n && hasSeal) {
          return { game_id: 1, account: 99n };
        }
        return undefined;
      },
    });
    expect(realmWornSkinFamily(storeFor(SEASON_ONE_REALM_SKIN, true) as never, settlement, 1, 0)).toBe(
      SEASON_ONE_REALM_SKIN,
    );
    expect(realmWornSkinFamily(storeFor(SEASON_ONE_REALM_SKIN, true) as never, city, 1, 1)).toBe(SEASON_ONE_REALM_SKIN);
    expect(realmWornSkinFamily(storeFor(SEASON_ONE_REALM_SKIN, true) as never, kingdom, 1, 2)).toBe(
      SEASON_ONE_REALM_SKIN,
    );
    expect(realmWornSkinFamily(storeFor(SEASON_ONE_REALM_SKIN, false) as never, settlement, 1, 0)).toBe(
      BASE_REALM_SKIN,
    );
    expect(realmWornSkinFamily(storeFor(SEASON_ONE_REALM_SKIN, false) as never, city, 1, 1)).toBe(BASE_REALM_SKIN);
    expect(realmWornSkinFamily(storeFor(SEASON_ONE_REALM_SKIN, false) as never, kingdom, 1, 2)).toBe(BASE_REALM_SKIN);
    expect(realmWornSkinFamily(storeFor(BASE_REALM_SKIN, true) as never, settlement, 1, 0)).toBe(BASE_REALM_SKIN);
    expect(realmWornSkinFamily(storeFor(SEASON_ONE_REALM_SKIN, true) as never, settlement, 1, 3)).toBe(BASE_REALM_SKIN);
    expect(wornRealmSkinFamily(holding(true, true, 3), SEASON_ONE_REALM_SKIN, 0)).toBe(SEASON_ONE_REALM_SKIN);
    expect(wornRealmSkinFamily(holding(true, true, 3), SEASON_ONE_REALM_SKIN, 1)).toBe(SEASON_ONE_REALM_SKIN);
    expect(wornRealmSkinFamily(holding(true, true, 3), SEASON_ONE_REALM_SKIN, 2)).toBe(SEASON_ONE_REALM_SKIN);
    expect(wornRealmSkinFamily(holding(true, false, 3), SEASON_ONE_REALM_SKIN, 2)).toBe(WONDER_REALM_SKIN);
    expect(showsWonder(holding(true, true, 3), SEASON_ONE_REALM_SKIN, 0)).toBe(false);
    expect(realmShowsWonder(storeFor(SEASON_ONE_REALM_SKIN, true) as never, wonderSettlement)).toBe(false);
    expect(showsWonder(holding(true, true, 3), SEASON_ONE_REALM_SKIN, 1)).toBe(false);
    expect(realmShowsWonder(storeFor(SEASON_ONE_REALM_SKIN, true) as never, wonderCity)).toBe(false);
    expect(showsWonder(holding(true, true, 3), SEASON_ONE_REALM_SKIN, 2)).toBe(false);
    expect(realmShowsWonder(storeFor(SEASON_ONE_REALM_SKIN, true) as never, wonderKingdom)).toBe(false);
    expect(showsWonder(holding(true, false, 3), SEASON_ONE_REALM_SKIN, 2)).toBe(true);
    expect(realmShowsWonder(storeFor(SEASON_ONE_REALM_SKIN, false) as never, wonderKingdom)).toBe(true);
    expect(showsWonder(holding(true, true, 3), SEASON_ONE_REALM_SKIN, 3)).toBe(true);
    expect(realmShowsWonder(storeFor(SEASON_ONE_REALM_SKIN, true) as never, wonderEmpire)).toBe(true);
  });
});
