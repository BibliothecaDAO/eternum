import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GOLDEN_DEVCON_HOLDERS,
  REGULAR_DEVCON_HOLDERS,
} from "../../../../contracts/l3/world-native/schema/devcon-holders.gen";
import {
  devconHoldingOf,
  equippedRealmSkin,
  holdsRealmSkin,
  realmAspect,
  realmOrderAspect,
  REALM_SKIN_FAMILIES,
  realmShowsWonder,
  realmWornSkinFamily,
  showsWonder,
  wornRealmSkinFamily,
} from "./realm-skin";

const {
  DEFAULT_REALM_SKIN,
  BASE_REALM_SKIN,
  SEASON_ONE_REALM_SKIN,
  WONDER_REALM_SKIN,
  DEVCON_REALM_SKIN,
  GOLDEN_DEVCON_REALM_SKIN,
} = REALM_SKIN_FAMILIES;

const realm = (hasWonder: boolean, order = 1, owner = 99n) =>
  ({
    game_id: 1,
    entity_id: 7n,
    owner,
    metadata: { has_wonder: hasWonder, order },
  }) as Parameters<typeof realmShowsWonder>[1];
const holding = (
  hasWonder: boolean,
  sealHeld = false,
  aspect: number | null = null,
  extra?: { devconHeld?: boolean; goldenDevconHeld?: boolean; devUnlocked?: boolean },
) => ({
  hasWonder,
  sealHeld,
  aspect,
  ...extra,
});
const storeWith = (family: number | undefined, devModeOn = false) => ({
  get: (model: string, key: { game_id: number; entity_id?: bigint }) => {
    if (model === "RealmSkin" && key.game_id === 1 && key.entity_id === 7n && family !== undefined) {
      return { game_id: 1, entity_id: 7n, family };
    }
    if (model === "GameRegistry" && key.game_id === 1) {
      return { game_id: 1, dev_mode_on: devModeOn };
    }
    return undefined;
  },
});

describe("the families a realm holds, as the chain decides them", () => {
  it("matches the contract's vectors for every Seal, Aspect, Wonder, Devcon, dev unlock and family", () => {
    const fields = readFileSync(
      new URL("../../../../contracts/l3/world-native/tests/fixtures/realm-skin-holds.txt", import.meta.url),
      "utf8",
    )
      .trim()
      .split(/\s+/)
      .map(Number);
    expect(fields).toHaveLength(3584);
    while (fields.length) {
      const [seal, aspect, wonder, devcon, goldenDevcon, devUnlocked, family, held] = fields.splice(0, 8) as number[];
      const state = {
        sealHeld: seal === 1,
        aspect: aspect!,
        hasWonder: wonder === 1,
        devconHeld: devcon === 1,
        goldenDevconHeld: goldenDevcon === 1,
        devUnlocked: devUnlocked === 1,
      };
      expect(
        holdsRealmSkin(state, family!),
        `${seal} ${aspect} ${wonder} ${devcon} ${goldenDevcon} ${devUnlocked} ${family}`,
      ).toBe(held === 1);
    }
  });

  it("recognizes every Devcon and Golden Devcon holder from the Season 0 archive without overlap", () => {
    expect(GOLDEN_DEVCON_HOLDERS).toHaveLength(8);
    expect(REGULAR_DEVCON_HOLDERS).toHaveLength(116);
    const archive = JSON.parse(
      readFileSync(new URL("../sync/season-archives/season-zero.json", import.meta.url), "utf8"),
    ) as { leaderboard: { entries: readonly { address: string }[] } };
    const archiveSet = new Set(archive.leaderboard.entries.map((entry) => BigInt(entry.address)));
    for (const address of GOLDEN_DEVCON_HOLDERS) {
      expect(archiveSet.has(BigInt(address))).toBe(true);
      expect(devconHoldingOf(address)).toEqual({ devconHeld: true, goldenDevconHeld: true });
      expect(devconHoldingOf(BigInt(address))).toEqual({ devconHeld: true, goldenDevconHeld: true });
    }
    for (const address of REGULAR_DEVCON_HOLDERS) {
      expect(archiveSet.has(BigInt(address))).toBe(true);
      expect(devconHoldingOf(address)).toEqual({ devconHeld: true, goldenDevconHeld: false });
      expect(devconHoldingOf(BigInt(address))).toEqual({ devconHeld: true, goldenDevconHeld: false });
    }
    expect(devconHoldingOf(99n)).toEqual({ devconHeld: false, goldenDevconHeld: false });
    expect(devconHoldingOf(null)).toEqual({ devconHeld: false, goldenDevconHeld: false });
    expect(devconHoldingOf("")).toEqual({ devconHeld: false, goldenDevconHeld: false });
  });
});

describe("the family a realm wears, which the game draws", () => {
  it("wears its Wonder by default when it holds one, else the base skin", () => {
    expect(wornRealmSkinFamily(holding(true), DEFAULT_REALM_SKIN)).toBe(WONDER_REALM_SKIN);
    expect(wornRealmSkinFamily(holding(false), DEFAULT_REALM_SKIN)).toBe(BASE_REALM_SKIN);
  });

  it("wears Golden Devcon and Devcon by default order and allows Golden Devcon holders to equip regular Devcon", () => {
    const regularOwner = BigInt(REGULAR_DEVCON_HOLDERS[0]!);
    const goldenOwner = BigInt(GOLDEN_DEVCON_HOLDERS[0]!);
    expect(realmWornSkinFamily(storeWith(DEFAULT_REALM_SKIN) as never, realm(false, 1, regularOwner))).toBe(
      DEVCON_REALM_SKIN,
    );
    expect(realmWornSkinFamily(storeWith(GOLDEN_DEVCON_REALM_SKIN) as never, realm(false, 1, regularOwner))).toBe(
      DEVCON_REALM_SKIN,
    );
    expect(realmWornSkinFamily(storeWith(DEFAULT_REALM_SKIN) as never, realm(false, 1, goldenOwner))).toBe(
      GOLDEN_DEVCON_REALM_SKIN,
    );
    expect(realmWornSkinFamily(storeWith(DEVCON_REALM_SKIN) as never, realm(false, 1, goldenOwner))).toBe(
      DEVCON_REALM_SKIN,
    );
    expect(wornRealmSkinFamily(holding(false, true, 2, { goldenDevconHeld: true }), DEFAULT_REALM_SKIN)).toBe(
      SEASON_ONE_REALM_SKIN,
    );
  });

  it("unlocks every drawn skin on dev games when explicitly equipped without overriding default order on prod or dev", () => {
    const ordinary = realm(false, 2, 99n);
    expect(realmWornSkinFamily(storeWith(DEFAULT_REALM_SKIN, true) as never, ordinary)).toBe(BASE_REALM_SKIN);
    for (const family of [
      BASE_REALM_SKIN,
      SEASON_ONE_REALM_SKIN,
      WONDER_REALM_SKIN,
      DEVCON_REALM_SKIN,
      GOLDEN_DEVCON_REALM_SKIN,
    ]) {
      expect(realmWornSkinFamily(storeWith(family, true) as never, ordinary)).toBe(family);
      expect(realmWornSkinFamily(storeWith(family, false) as never, ordinary)).toBe(BASE_REALM_SKIN);
    }
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

  it("resolves Season 1 across all ranks while the Seal and Aspect are held, falling back when the Seal is lost", () => {
    const ordinary = realm(false, 1);
    const wonderRealm = realm(true, 3);
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
    expect(realmWornSkinFamily(storeFor(DEFAULT_REALM_SKIN, true) as never, ordinary, 1)).toBe(SEASON_ONE_REALM_SKIN);
    expect(realmWornSkinFamily(storeFor(SEASON_ONE_REALM_SKIN, true) as never, ordinary, 1)).toBe(
      SEASON_ONE_REALM_SKIN,
    );
    expect(realmWornSkinFamily(storeFor(SEASON_ONE_REALM_SKIN, false) as never, ordinary, 1)).toBe(BASE_REALM_SKIN);
    expect(realmWornSkinFamily(storeFor(BASE_REALM_SKIN, true) as never, ordinary, 1)).toBe(BASE_REALM_SKIN);
    expect(wornRealmSkinFamily(holding(true, true, 3), SEASON_ONE_REALM_SKIN)).toBe(SEASON_ONE_REALM_SKIN);
    expect(wornRealmSkinFamily(holding(true, false, 3), SEASON_ONE_REALM_SKIN)).toBe(WONDER_REALM_SKIN);
    expect(showsWonder(holding(true, true, 3), SEASON_ONE_REALM_SKIN)).toBe(false);
    expect(realmShowsWonder(storeFor(SEASON_ONE_REALM_SKIN, true) as never, wonderRealm)).toBe(false);
    expect(showsWonder(holding(true, false, 3), SEASON_ONE_REALM_SKIN)).toBe(true);
    expect(realmShowsWonder(storeFor(SEASON_ONE_REALM_SKIN, false) as never, wonderRealm)).toBe(true);
  });

  it("reads HomeAspect ahead of legacy order and falls back to order when HomeAspect is absent", () => {
    const storeWithAspect = (aspect?: number, hasSeal = false) => ({
      get: (model: string, key: { game_id: number; home?: bigint; account?: bigint }) => {
        if (model === "HomeAspect" && key.game_id === 1 && key.home === 7n && aspect !== undefined) {
          return { game_id: 1, home: 7n, aspect };
        }
        if (model === "Seal" && key.game_id === 1 && key.account === 99n && hasSeal) {
          return { game_id: 1, account: 99n };
        }
        return undefined;
      },
    });
    const unaligned = realm(true, 0);
    expect(realmOrderAspect(0, 3)).toBe(3);
    expect(realmOrderAspect(1, 3)).toBe(3);
    expect(realmOrderAspect(1, null)).toBe(1);
    expect(realmOrderAspect(0, null)).toBeNull();
    expect(realmAspect(storeWithAspect(3) as never, unaligned)).toBe(3);
    expect(realmAspect(storeWithAspect(undefined) as never, unaligned)).toBeNull();
    expect(realmAspect(storeWithAspect(undefined) as never, realm(true, 1))).toBe(1);
    expect(realmWornSkinFamily(storeWithAspect(3, true) as never, realm(false, 0))).toBe(SEASON_ONE_REALM_SKIN);
  });
});
