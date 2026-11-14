import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import * as timestamp from "./timestamp";
import {
  armyEtherealLayer,
  dayOf,
  entityHomeNamespace,
  seasonDay,
  expeditionDayEndsAt,
  expeditionRealmSite,
  expeditionSpires,
  expeditionSpireTile,
  isArmyCrossing,
  isAtExpeditionSpire,
  isEtherealTile,
  liveHomeArmies,
  structureMapPosition,
  structureLocalPosition,
  siteReward,
  siteClearXp,
  spireEtherealView,
  viewInLayer,
  regionSpire,
  LOCAL_VIEW_REACH,
} from "./expeditions";

const structure = (overrides: { realm_id?: number; category?: StructureType } = {}) =>
  ({
    game_id: 7,
    entity_id: overrides.realm_id ?? 3,
    base: { category: overrides.category ?? StructureType.Realm },
    metadata: { realm_id: overrides.realm_id ?? 3 },
  }) as never;

// Four-hour units from t=86400, days drawn from seed 1; spacing 10, so day d's regions are rows 40d..40d+39.
const rules = {
  dayUnitSeconds: 14_400,
  spacing: 10,
  startMainAt: 86_400,
  scheduledEndAt: 86_400 + 21 * 20 * 14_400,
  endAt: 86_400 + 21 * 20 * 14_400,
  seed: 1n,
};
const expeditionRules = {
  SliceRules: { day_unit_seconds: rules.dayUnitSeconds },
  SettlementRules: { spacing: rules.spacing },
  GameRegistry: {
    start_main_at: BigInt(rules.startMainAt),
    scheduled_end_at: BigInt(rules.endAt),
    end_at: BigInt(rules.endAt),
    seed: rules.seed,
  },
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

  const army = (explorer_id: number, y: number, count = 1_000n, owner = 42, day = 0) => ({
    day,
    explorer_id,
    owner,
    position: { x: 25, y, alt: false },
    troops: { count },
  });
  const armiesStore = (rules: Record<string, unknown>, armies: ReturnType<typeof army>[]) => ({
    ...storeWith(rules),
    require: (model: string, keys: { explorer_id: number }) =>
      model === "ArmyDay"
        ? { day: armies.find((army) => army.explorer_id === keys.explorer_id)!.day }
        : storeWith(rules).require(model),
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

  it("uses allocation days when two days' armies share the same map tile", () => {
    const store = armiesStore(expeditionRules, [army(1, 35, 1_000n, 42, 0), army(2, 35, 1_000n, 42, 1)]);
    atFloor(dayStart(1));
    expect(liveHomeArmies(store as never, 42, 7).map(({ explorer_id }) => explorer_id)).toEqual([2]);
    atFloor(dayStart(2));
    expect(liveHomeArmies(store as never, 42, 7)).toEqual([]);
  });

  it("counts every army with troops in a game without expeditions", () => {
    const store = armiesStore({ SliceRules: { day_unit_seconds: 0 } }, [army(1, 5), army(2, 900), army(3, 7, 0n)]);
    atFloor(86400 * 9);
    expect(liveHomeArmies(store as never, 42, 7).map(({ explorer_id }) => explorer_id)).toEqual([1, 2]);
  });

  it("names the Ethereal layer each army stands in, and none on the surface or without expeditions", () => {
    // Day 0: the surface is rows 0..9, Ethereal I rows 10..19, Ethereal III rows 30..39.
    const store = armiesStore(expeditionRules, [army(1, 6), army(2, 15), army(3, 35)]);
    expect([1, 2, 3].map((id) => armyEtherealLayer(store as never, 7, id))).toEqual([undefined, 1, 3]);
    const plain = armiesStore({ SliceRules: { day_unit_seconds: 0 } }, [army(2, 15)]);
    expect(armyEtherealLayer(plain as never, 7, 2)).toBeUndefined();
  });

  describe("a look into a spire's Ethereal layer", () => {
    // Realm 42's spire on day 0's surface (rows 0..9); Ethereal I below is rows 10..19, Ethereal II rows 20..29.
    const spire = { col: 24, row: 5, realm: { game_id: 7, entity_id: 42 } as never };

    it("goes to the realm's army in the Ethereal layer today", () => {
      const store = armiesStore(expeditionRules, [army(1, 6), army(2, 25)]);
      atFloor(rules.startMainAt + 60);
      expect(spireEtherealView(store as never, spire)).toEqual({ col: 25, row: 25 });
    });

    it("goes to Ethereal I straight below the spire while none of the realm's armies is there", () => {
      const store = armiesStore(expeditionRules, [army(1, 6), army(2, 25, 1_000n, 99)]);
      atFloor(rules.startMainAt + 60);
      expect(spireEtherealView(store as never, spire)).toEqual({ col: 24, row: 15 });
    });
  });

  it("finds the same spot in each layer of its region, from the surface or from any Ethereal layer", () => {
    // Day 0, spacing 10: the surface is rows 0..9, Ethereal I rows 10..19, II rows 20..29, III rows 30..39.
    const layers = [0, 1, 2, 3] as const;
    expect(layers.map((layer) => viewInLayer(rules, { col: 24, row: 7 }, layer))).toEqual([
      { col: 24, row: 7 },
      { col: 24, row: 17 },
      { col: 24, row: 27 },
      { col: 24, row: 37 },
    ]);
    expect(layers.map((layer) => viewInLayer(rules, { col: 24, row: 23 }, layer).row)).toEqual([3, 13, 23, 33]);
    // Day 1's surface starts at row 40: its layers stay in day 1.
    expect(viewInLayer(rules, { col: 3, row: 71 }, 0)).toEqual({ col: 3, row: 41 });
  });

  it("finds the realm's own spire on the surface, and the spot under it in each Ethereal layer of the region", () => {
    const now = dayStart(1) + 60;
    const own = expeditionSpireTile(rules, structure(), now)!;
    const site = expeditionRealmSite(rules, entityHomeNamespace(3), now)!;
    for (const layer of [0, 1, 2, 3])
      expect(regionSpire(rules, { col: site.col - 2, row: site.row + layer * rules.spacing + 1 })).toEqual({
        col: own.col,
        row: own.row + layer * rules.spacing,
      });
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
    expect(expeditionSpireTile(rules, realm(3), dayStart(1) + 10)).toEqual({ col: 25, row: 46 });
    // Day 2: site (25, 85), direction 2 on odd row 85 is (24, 86).
    expect(expeditionSpireTile(rules, realm(3), dayStart(2) + 10)).toEqual({ col: 24, row: 86 });
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
          ? { learned: key.structure_id === 3 ? 1n << 48n : 0n }
          : storeWith(expeditionRules).get(model),
      inGame: (model: string) => (model === "Structure" ? [realm(1), realm(3)] : [])[Symbol.iterator](),
    };
    expect(expeditionSpires(store as never, 7, dayStart(1) + 10)).toEqual([
      { col: 25, row: 46, deepest: 1, realm: realm(3) },
    ]);
  });
});

describe("isEtherealTile", () => {
  it("draws Ethereal I to III with the ethereal surface, and each day's surface without it", () => {
    // Spacing 10: day 1's surface is rows 40..49, its Ethereal I to III rows 50..79, day 2's surface rows 80..89.
    expect([45, 49, 50, 65, 79, 80].map((row) => isEtherealTile(rules, { row, alt: false }))).toEqual([
      false,
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it("draws Eternum's other layer ethereal, and nothing else in a game without expeditions", () => {
    expect(isEtherealTile(null, { row: 65, alt: true })).toBe(true);
    expect(isEtherealTile(null, { row: 65, alt: false })).toBe(false);
  });
});

describe("isArmyCrossing", () => {
  const at = (col: number, row: number, alt = false) => ({ col, row, alt });

  it("crosses through the spire into the Ethereal layer a region down, as enter_depth places the army", () => {
    const store = storeWith(expeditionRules);
    // Day 1's surface region of home 3 is rows 40..49, columns 20..29; Ethereal I lies a spacing below, rows 50..59.
    expect(isArmyCrossing(store, 7, at(25, 46), at(25, 56))).toBe(true);
    expect(isArmyCrossing(store, 7, at(25, 46), at(25, 76))).toBe(true);
  });

  it("walks any step inside one region, up to its edge", () => {
    const store = storeWith(expeditionRules);
    expect(isArmyCrossing(store, 7, at(25, 46), at(26, 47))).toBe(false);
    expect(isArmyCrossing(store, 7, at(20, 40), at(29, 49))).toBe(false);
  });

  it("crosses between map layers in any game, and walks everywhere else without expeditions", () => {
    const store = storeWith({ ...expeditionRules, SliceRules: { day_unit_seconds: 0 } });
    expect(isArmyCrossing(store, 7, at(25, 46), at(25, 46, true))).toBe(true);
    expect(isArmyCrossing(store, 7, at(25, 46), at(25, 56))).toBe(false);
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
  it.each([
    [548n, 137n],
    [320n, 80n],
  ])("previews the Beasts Labor for %s starting troops", (troops, labor) => {
    expect(
      siteReward(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        category: StructureType.Beasts,
        initial_guard_count: troops * 1_000_000_000n,
        clear: null,
      }),
    ).toEqual({ resourceType: ResourcesIds.Labor, amount: labor * 1_000_000_000n });
  });
  it("pays as the contract does: a camp half its first guard in labor, a rift three times it in Essence", () => {
    const guard = 1_100n * 1_000_000_000n;
    expect(
      siteReward(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        category: StructureType.Camp,
        initial_guard_count: guard,
        clear: null,
      }),
    ).toEqual({
      resourceType: ResourcesIds.Labor,
      amount: 550n * 1_000_000_000n,
    });
    expect(
      siteReward(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        category: StructureType.Rift,
        initial_guard_count: guard,
        clear: null,
      }),
    ).toEqual({
      resourceType: ResourcesIds.Essence,
      amount: 3_300n * 1_000_000_000n,
    });
    // An odd scaled count halves as the contract's integer division does.
    expect(
      siteReward(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        category: StructureType.Camp,
        initial_guard_count: 3n,
        clear: null,
      })?.amount,
    ).toBe(1n);
    expect(
      siteReward(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        category: StructureType.Beasts,
        initial_guard_count: guard,
        clear: null,
      }),
    ).toEqual({
      resourceType: ResourcesIds.Labor,
      amount: guard / 4n,
    });
    expect(
      siteReward(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        category: StructureType.Ruin,
        initial_guard_count: guard,
        clear: null,
      }),
    ).toBeNull();
  });

  it("pays nothing more once the site is cleared: the contract pays a site once", () => {
    const guard = 1_100n * 1_000_000_000n;
    expect(
      siteReward(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        category: StructureType.Camp,
        initial_guard_count: guard,
        clear: { explorer_id: 1n, home_id: 7n, reward: null },
      }),
    ).toBeNull();
    expect(
      siteReward(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        category: StructureType.Rift,
        initial_guard_count: guard,
        clear: { explorer_id: 1n, home_id: 7n, reward: null },
      }),
    ).toBeNull();
  });
});

describe("siteClearXp", () => {
  it.each([
    [430n, 51],
    [1300n, 90],
    [3000n, 136],
    [25000n, 395],
    [49500n, 556],
  ])("matches the contract's clear vector for %s troops", (troops, xp) => {
    expect(
      siteClearXp(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        initial_guard_count: troops * 1_000_000_000n,
      }),
    ).toBe(xp);
  });

  it("floors fractional troops and keeps integer square-root boundaries exact", () => {
    expect(
      siteClearXp(storeWith(expeditionRules) as never, { game_id: 7, row: 0, initial_guard_count: 999_999_999n }),
    ).toBe(0);
    expect(
      siteClearXp(storeWith(expeditionRules) as never, { game_id: 7, row: 0, initial_guard_count: 1_999_999_999n }),
    ).toBe(2);
    const square = (2n * 30_000_000n) ** 2n;
    expect(
      siteClearXp(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        initial_guard_count: (square - 1n) * 1_000_000_000n,
      }),
    ).toBe(149_999_999);
    expect(
      siteClearXp(storeWith(expeditionRules) as never, {
        game_id: 7,
        row: 0,
        initial_guard_count: square * 1_000_000_000n,
      }),
    ).toBe(150_000_000);
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
        storeWith({
          ...expeditionRules,
          GameRegistry: {
            start_main_at: BigInt(late.startMainAt),
            scheduled_end_at: BigInt(late.endAt),
            end_at: BigInt(late.endAt),
            seed: late.seed,
          },
        }),
        structure(),
      ),
    ).toBeNull();
  }
  expect(seasonDay(late, late.startMainAt)).toBe(0);
  expect(expeditionRealmSite(late, 1, late.startMainAt)).toEqual({ col: 5, row: 5 });
  vi.restoreAllMocks();
});

it("keeps a full-width home namespace distinct from its trait template", () => {
  const home = 0x0100000000000001n;
  expect(entityHomeNamespace(home)).toBe(0x01000000);
  expect(entityHomeNamespace(3)).toBe(3);
  expect(() => entityHomeNamespace(Number(home))).toThrow("Unsafe");
  vi.spyOn(timestamp, "getBlockTimestamp").mockReturnValue({ currentBlockTimestamp: dayStart(0) } as never);
  expect(structureMapPosition(storeWith(expeditionRules), { ...structure(), entity_id: home } as never)).toEqual({
    x: (0x01000000 - 1) * rules.spacing + rules.spacing / 2,
    y: rules.spacing / 2,
    alt: false,
  });
  vi.restoreAllMocks();
});

it.each([
  [0, 1, 51],
  [1, 1.5, 76],
  [2, 2, 102],
  [3, 2.5, 127],
])("previews depth %s resources and XP from the site's day band", (depth, multiplier, xp) => {
  const store = storeWith(expeditionRules) as never;
  const site = {
    game_id: 7,
    row: 80 + depth * 10 + 5,
    category: StructureType.Rift,
    initial_guard_count: 430n * 1_000_000_000n,
    clear: null,
  };
  expect(siteReward(store, site)).toEqual({
    resourceType: ResourcesIds.Essence,
    amount: BigInt(1290 * multiplier) * 1_000_000_000n,
  });
  expect(siteClearXp(store, site)).toBe(xp);
});
