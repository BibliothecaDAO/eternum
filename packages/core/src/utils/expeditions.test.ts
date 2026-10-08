import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import * as timestamp from "./timestamp";
import {
  dayOf,
  seasonDay,
  expeditionDayEndsAt,
  expeditionRealmSite,
  expeditionSpires,
  expeditionSpireTile,
  isAtExpeditionSpire,
  liveHomeArmies,
  structureMapPosition,
  structureLocalPosition,
  siteReward,
  LOCAL_VIEW_REACH,
} from "./expeditions";

const structure = (overrides: { realm_id?: number; category?: StructureType } = {}) =>
  ({
    game_id: 7,
    entity_id: 42,
    base: { category: overrides.category ?? StructureType.Realm },
    metadata: { realm_id: overrides.realm_id ?? 3 },
  }) as never;

// Four-hour units from t=86400, days drawn from seed 1; spacing 10, so day d's regions are rows 40d..40d+39.
const rules = { dayUnitSeconds: 14_400, spacing: 10, startMainAt: 86_400, seed: 1n };
const expeditionRules = {
  SliceRules: { day_unit_seconds: rules.dayUnitSeconds },
  SettlementRules: { spacing: rules.spacing },
  GameRegistry: { start_main_at: BigInt(rules.startMainAt), seed: rules.seed },
};
/** The first second of season day `index`. */
const dayStart = (index: number) => {
  let day = dayOf(rules, rules.startMainAt)!;
  while (day.index < index) day = dayOf(rules, day.end)!;
  return day.start;
};

const storeWith = (rows: Record<string, unknown>) => ({
  get: (model: string) => rows[model],
  entityOccupancy: () => rows.TileOccupancy as { col: number; row: number; alt: boolean } | undefined,
  require: (model: string) => {
    if (!(model in rows)) throw new Error(`missing ${model}`);
    return rows[model];
  },
});

describe("structureMapPosition", () => {
  afterEach(() => vi.restoreAllMocks());

  it("maps an off-map Frontier realm to today's expedition site", () => {
    vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentBlockTimestamp: dayStart(1) + 10 } as never);
    const store = storeWith(expeditionRules);
    expect(structureMapPosition(store, structure({ realm_id: 3 }))).toEqual({
      x: 25,
      y: 45,
      alt: false,
    });
  });

  it("keeps the local realm terrain reference stable across Frontier days", () => {
    const store = storeWith(expeditionRules);
    for (const day of [1, 2]) {
      vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentBlockTimestamp: dayStart(day) } as never);
      expect(structureLocalPosition(store, structure({ realm_id: 3 }))).toEqual({
        x: 4294967290,
        y: 4294967293,
        alt: false,
      });
    }
  });

  it("keeps every hex the local view reads around a Frontier realm inside the tile key's range", () => {
    vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentBlockTimestamp: dayStart(1) } as never);
    const store = storeWith(expeditionRules);
    for (const realmId of [1, 3098, 8000]) {
      const { x, y } = structureLocalPosition(store, structure({ realm_id: realmId }));
      for (const edge of [x + LOCAL_VIEW_REACH, y + LOCAL_VIEW_REACH]) expect(edge).toBeLessThanOrEqual(2 ** 32 - 1);
    }
  });

  it("keeps every other structure on its own coordinate", () => {
    for (const alt of [false, true]) {
      const store = storeWith({ TileOccupancy: { col: 12, row: 18, alt } });
      expect(structureMapPosition(store, structure())).toEqual({ x: 12, y: 18, alt });
    }
  });

  it("fails loudly when an on-map structure has no occupancy", () => {
    const store = storeWith({ SliceRules: { day_unit_seconds: 0 } });
    expect(() => structureMapPosition(store, structure())).toThrow("Missing native position");
  });
});

describe("liveHomeArmies", () => {
  afterEach(() => vi.restoreAllMocks());

  const army = (explorer_id: number, y: number, count = 1_000n, owner = 42) => ({
    explorer_id,
    owner,
    position: { x: 25, y, alt: false },
    troops: { count },
  });
  const armiesStore = (rules: Record<string, unknown>, armies: ReturnType<typeof army>[]) => ({
    ...storeWith(rules),
    armiesAtHome: (_game: number, home: number) => armies.filter((army) => army.owner === home),
    entityOccupancy: (_game: number, id: number) => {
      const army = armies.find((army) => army.explorer_id === id);
      return army && { col: army.position.x, row: army.position.y, alt: army.position.alt };
    },
  });
  const atFloor = (seconds: number) =>
    vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentDefaultTick: seconds } as never);

  it("counts today's armies, and none from an earlier day once the day rolls over", () => {
    // Day 0's region rows are 0..39 (spacing 10, four rows of regions a day); day 1's are 40..79.
    const store = armiesStore(expeditionRules, [army(1, 5), army(2, 6), army(3, 7, 0n), army(4, 5, 1_000n, 99)]);
    atFloor(rules.startMainAt + 60);
    expect(liveHomeArmies(store as never, 42, 7).map(({ explorer_id }) => explorer_id)).toEqual([1, 2]);

    atFloor(dayStart(1) + 1);
    expect(liveHomeArmies(store as never, 42, 7)).toEqual([]);
  });

  it("counts every army with troops in a game without expeditions", () => {
    const store = armiesStore({ SliceRules: { day_unit_seconds: 0 } }, [army(1, 5), army(2, 900), army(3, 7, 0n)]);
    atFloor(86400 * 9);
    expect(liveHomeArmies(store as never, 42, 7).map(({ explorer_id }) => explorer_id)).toEqual([1, 2]);
  });
});

describe("expedition spire", () => {
  // Realm 3's day-1 site is (25, 45), an odd row.
  const realm = (id: number) =>
    ({
      game_id: 7,
      entity_id: id,
      base: { category: StructureType.Realm },
      metadata: { realm_id: 3 },
    }) as never;

  it("stands on the home ring's tile in direction (day % 6) and turns one step each day", () => {
    // Day 1: the site's neighbour in direction 1 on odd row 45 is (25, 46).
    expect(expeditionSpireTile(rules, realm(1), dayStart(1) + 10)).toEqual({ col: 25, row: 46 });
    // Day 2: site (25, 85), direction 2 on odd row 85 is (24, 86).
    expect(expeditionSpireTile(rules, realm(1), dayStart(2) + 10)).toEqual({ col: 24, row: 86 });
  });

  it("takes an army on the spire or beside it, and nowhere else", () => {
    const spire = { col: 25, row: 46 };
    expect(isAtExpeditionSpire(spire, { x: 25, y: 46 })).toBe(true);
    expect(isAtExpeditionSpire(spire, { x: 26, y: 46 })).toBe(true);
    expect(isAtExpeditionSpire(spire, { x: 27, y: 46 })).toBe(false);
  });

  it("lights a spire only for a realm with depth research", () => {
    const store = {
      ...storeWith(expeditionRules),
      get: (model: string, key: { structure_id: number }) =>
        model === "RealmKnowledge"
          ? { learned: key.structure_id === 2 ? 1n << 46n : 0n }
          : storeWith(expeditionRules).get(model),
      inGame: (model: string) => (model === "Structure" ? [realm(0), realm(2)] : [])[Symbol.iterator](),
    };
    expect(expeditionSpires(store as never, 7, dayStart(1) + 10)).toEqual([{ col: 25, row: 46 }]);
  });
});

describe("expeditionDayEndsAt", () => {
  it("ends the day where the next drawn day starts", () => {
    expect(expeditionDayEndsAt(rules, dayStart(2) + 5)).toBe(dayStart(3));
  });

  it("starts a new day exactly on the boundary", () => {
    expect(expeditionDayEndsAt(rules, dayStart(3))).toBe(dayStart(4));
  });

  it("counts down to the season's start before it", () => {
    expect(expeditionDayEndsAt(rules, rules.startMainAt - 5)).toBe(rules.startMainAt);
  });
});

it("counts season days from the exact start, whatever the time of day", () => {
  const offset = { ...rules, startMainAt: rules.startMainAt + 2_350 };
  expect(seasonDay(offset, offset.startMainAt)).toBe(0);
  expect(seasonDay(offset, dayOf(offset, offset.startMainAt)!.end - 1)).toBe(0);
  expect(seasonDay(offset, dayOf(offset, offset.startMainAt)!.end)).toBe(1);
});

describe("siteReward", () => {
  it("pays as the contract does: a camp half its first guard in labor, a rift three times it in Essence", () => {
    const guard = 1_100n * 1_000_000_000n;
    expect(siteReward("Camp", { initial_guard_count: guard })).toEqual({
      resourceType: ResourcesIds.Labor,
      amount: 550n * 1_000_000_000n,
    });
    expect(siteReward("Rift", { initial_guard_count: guard })).toEqual({
      resourceType: ResourcesIds.Essence,
      amount: 3_300n * 1_000_000_000n,
    });
    // An odd scaled count halves as the contract's integer division does.
    expect(siteReward("Camp", { initial_guard_count: 3n })?.amount).toBe(1n);
    expect(siteReward("Stragglers", { initial_guard_count: guard })).toBeNull();
    expect(siteReward("Ruin", { initial_guard_count: guard })).toBeNull();
  });
});

it("has no season day or map site before the exact start", () => {
  const late = { ...rules, startMainAt: 86400 + 3600 };
  for (const now of [0, 86400, late.startMainAt - 1]) {
    expect(seasonDay(late, now)).toBeNull();
    expect(expeditionRealmSite(late, 1, now)).toBeNull();
    expect(expeditionSpireTile(late, structure(), now)).toBeNull();
    vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentBlockTimestamp: now } as never);
    expect(
      structureMapPosition(
        storeWith({ ...expeditionRules, GameRegistry: { start_main_at: BigInt(late.startMainAt), seed: late.seed } }),
        structure(),
      ),
    ).toBeNull();
  }
  expect(seasonDay(late, late.startMainAt)).toBe(0);
  expect(expeditionRealmSite(late, 1, late.startMainAt)).toEqual({ col: 5, row: 5 });
  vi.restoreAllMocks();
});
