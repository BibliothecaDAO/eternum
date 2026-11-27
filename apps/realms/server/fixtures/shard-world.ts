import { frontierSeasonOnePreset } from "../../../../config/source/frontier/season-one";
import { NATIVE_RELEASES } from "../../../../deploy/release/native-release";
import type { HeraldGameSnapshot } from "@bibliothecadao/eternum/game-sync";
import { nativeBaneConstants, nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import { deepSites, RESOURCE_PRECISION, TileOccupier } from "@bibliothecadao/types";
import release from "../../../../contracts/l3/world-native/schema/release-definition.json";
import explorerFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { gameRegistryRow } from "../../../../packages/core/src/test-support/game-registry";
import { dayAtIndex } from "../../../../packages/core/src/utils/days";

export const siteGuardTroops = (ticksUntilClear: number, clearableTroops = 1200) =>
  clearableTroops + ticksUntilClear * frontierSeasonOnePreset.deep.lossPerTick;

export const GAME_ID = 1;
export const RELEASE = NATIVE_RELEASES.frontier.release;
export const PLAYER_ACCOUNT = "0x4b1d";
export const HOME = 5;
export const ARMY = 7;
const NEIGHBOUR_HOME = 6;
const NEIGHBOUR_ARMY = 8;
const SECOND_ARMY = 10;
export const ARMIES_TICK_SECONDS = 10;
export const REST_TICKS = 3;
const STAMINA_GAIN_PER_TICK = release.definition.rules.troop_stamina_config.stamina_knight_max / REST_TICKS;
export const DAY_UNIT_SECONDS = 14_400;
const REGION_SPACING = 100;
export const TODAY = frontierSeasonOnePreset.banes.quietDays;
const TODAY_OPENS_AFTER = dayAtIndex(
  {
    seed: 1n,
    startMainAt: 0,
    scheduledEndAt: 40 * DAY_UNIT_SECONDS,
    endAt: 40 * DAY_UNIT_SECONDS,
    dayUnitSeconds: DAY_UNIT_SECONDS,
  },
  TODAY,
).start;
export const SEASON_START = Math.floor(Date.now() / 1000) - TODAY_OPENS_AFTER - 3_600;

export type ArmyState = {
  amount: number;
  settledAt: number;
  day: number;
  mapDay?: number;
  deepTick?: number;
};

/** Structure owners, so the fake narrows armies to one account's as Herald's owner filter does. */
const STRUCTURE_OWNERS = new Map([
  [HOME, PLAYER_ACCOUNT],
  [NEIGHBOUR_HOME, "0x7e1"],
]);

export function mistFacts(endedAt: number | undefined, rolled: number | null = nativeBaneConstants.MIST_TIDE) {
  if (endedAt === undefined) return [];
  return [
    {
      model: "BaneRules",
      rows: [
        {
          key: "0xb01",
          value: {
            game_id: GAME_ID,
            chance_step: frontierSeasonOnePreset.banes.chanceStep,
            quorum_percent: 25,
            beast_percent: 150,
            stamina_percent: 50,
            production_percent: 50,
            quest_counts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 15000],
          },
        },
      ],
    },
    { model: "HomeAspect", rows: [{ key: "0xb02", value: { game_id: GAME_ID, home: HOME, aspect: 1 } }] },
    {
      model: "AspectActivity",
      rows: [{ key: "0xb03", value: { game_id: GAME_ID, aspect: 1, day: TODAY - 1, active: 4 } }],
    },
    {
      model: "WorldBane",
      rows: rolled === null ? [] : [{ key: "0xb04", value: { game_id: GAME_ID, day: TODAY, kind: rolled } }],
    },
    {
      model: "BaneProgress",
      rows: [
        {
          key: "0xb05",
          value: { game_id: GAME_ID, aspect: 1, day: TODAY, completed: endedAt === 0 ? 0 : 1, ended_at: endedAt },
        },
      ],
    },
  ];
}

export const snapshot = (
  army: ArmyState | null,
  neighbour: ArmyState | null,
  owner: string | null,
  members: string[],
  second: ArmyState | null,
): HeraldGameSnapshot => ({
  confirmed_block: 10,
  game_id: String(GAME_ID),
  models: [
    {
      model: "GameRelease",
      rows: [
        {
          key: "0x1",
          value: { game_id: GAME_ID, release_id: RELEASE, created_release_id: RELEASE },
        },
      ],
    },
    {
      model: "Structure",
      rows: [HOME, NEIGHBOUR_HOME]
        .filter((home) => owner === null || BigInt(STRUCTURE_OWNERS.get(home)!) === BigInt(owner))
        .map((home) => ({ key: `0x${home.toString(16)}`, value: realmRow(home) })),
    },
    {
      model: "RealmKnowledge",
      rows: [HOME, NEIGHBOUR_HOME].map((structure_id) => ({
        key: `0x${structure_id}`,
        value: { game_id: GAME_ID, structure_id, learned: "0" },
      })),
    },
    {
      model: "SettledRealm",
      rows: [{ key: "0x2c7", value: { game_id: GAME_ID, realm_id: 711, home: HOME } }],
    },
    {
      model: "PlayerEntry",
      rows: members.map((account) => ({
        key: account,
        value: {
          game_id: GAME_ID,
          owner: account,
          player: "0xdead",
        },
      })),
    },
    {
      model: "SliceRules",
      rows: [
        {
          key: "0x1",
          value: {
            ...release.definition.rules,
            game_id: GAME_ID,
            tick_config: { ...release.definition.rules.tick_config, armies_tick_in_seconds: ARMIES_TICK_SECONDS },
            troop_stamina_config: {
              ...release.definition.rules.troop_stamina_config,
              stamina_gain_per_tick: STAMINA_GAIN_PER_TICK,
            },
            day_unit_seconds: DAY_UNIT_SECONDS,
          },
        },
      ],
    },
    {
      model: "SettlementRules",
      rows: [
        {
          key: "0x4",
          value: {
            game_id: GAME_ID,
            registration_start: 0,
            registration_limit: 0,
            mode: "Single",
            spacing: REGION_SPACING,
          },
        },
      ],
    },
    {
      model: "GameRegistry",
      rows: [
        {
          key: "0x5",
          value: gameRegistryRow({
            game_id: GAME_ID,
            name: "0x1",
            start_settling_at: String(SEASON_START),
            start_main_at: String(SEASON_START),
            scheduled_end_at: String(SEASON_START + 2 * 20 * DAY_UNIT_SECONDS),
            end_at: String(SEASON_START + 2 * 20 * DAY_UNIT_SECONDS),
            seed: "0x1",
          }),
        },
      ],
    },
    {
      model: "TileOccupancy",
      rows: [
        ...(army ? [armyPosition(ARMY, HOME, army)] : []),
        ...(second ? [armyPosition(SECOND_ARMY, HOME, second, 1)] : []),
        ...(neighbour ? [armyPosition(NEIGHBOUR_ARMY, NEIGHBOUR_HOME, neighbour)] : []),
      ]
        .filter(({ home }) => owner === null || BigInt(STRUCTURE_OWNERS.get(home)!) === BigInt(owner))
        .map(({ home: _home, ...row }) => row),
    },
    {
      model: "ArmyDay",
      rows: [
        ...(army ? [{ id: ARMY, home: HOME, day: army.day }] : []),
        ...(second ? [{ id: SECOND_ARMY, home: HOME, day: second.day }] : []),
        ...(neighbour ? [{ id: NEIGHBOUR_ARMY, home: NEIGHBOUR_HOME, day: neighbour.day }] : []),
      ]
        .filter(({ home }) => owner === null || BigInt(STRUCTURE_OWNERS.get(home)!) === BigInt(owner))
        .map(({ id, day }) => ({ key: `0x${id.toString(16)}`, value: { game_id: GAME_ID, explorer_id: id, day } })),
    },
    {
      model: "DeepArmy",
      rows:
        army?.deepTick === undefined
          ? []
          : [{ key: "0xdee2", value: { game_id: GAME_ID, explorer_id: ARMY, last_tick: army.deepTick } }],
    },
    {
      model: "DeepRules",
      rows:
        army?.deepTick === undefined
          ? []
          : [
              {
                key: "0xdee3",
                value: {
                  game_id: GAME_ID,
                  gate_distance: 4,
                  rings: [{ radius: 5, realms: 0 }],
                  beasts: [
                    { count: 100, bow: false },
                    { count: 100, bow: true },
                    { count: 100, bow: false },
                    { count: 100, bow: true },
                  ],
                  loss_per_tick: 100,
                  core_per_tick: 500,
                  mine_per_tick: 500,
                  building_pay: { alone: 6, pair: 3, crowd: 2 },
                  altar_threshold: 1500,
                },
              },
            ],
    },
    {
      model: "ArmySlot",
      rows: [
        ...(army ? [armySlotRow(ARMY, HOME, army)] : []),
        ...(second ? [armySlotRow(SECOND_ARMY, HOME, second, 1)] : []),
        ...(neighbour ? [armySlotRow(NEIGHBOUR_ARMY, NEIGHBOUR_HOME, neighbour)] : []),
      ].filter(({ value }) => owner === null || BigInt(STRUCTURE_OWNERS.get(value.structure_id)!) === BigInt(owner)),
    },
    {
      model: "ArmyCombat",
      rows: [
        ...(army ? [armyCombatRow(ARMY)] : []),
        ...(second ? [armyCombatRow(SECOND_ARMY)] : []),
        ...(neighbour ? [armyCombatRow(NEIGHBOUR_ARMY)] : []),
      ],
    },
    {
      model: "ArmyProgress",
      rows: [
        ...(army ? [armyProgressRow(ARMY, HOME)] : []),
        ...(second ? [armyProgressRow(SECOND_ARMY, HOME)] : []),
        ...(neighbour ? [armyProgressRow(NEIGHBOUR_ARMY, NEIGHBOUR_HOME)] : []),
      ]
        .filter(({ home }) => owner === null || BigInt(STRUCTURE_OWNERS.get(home)!) === BigInt(owner))
        .map(({ home: _home, ...row }) => row),
    },
    {
      model: "ExplorerTroops",
      rows: [
        ...(army ? [armyRow(ARMY, HOME, army)] : []),
        ...(second ? [armyRow(SECOND_ARMY, HOME, second, 1)] : []),
        ...(neighbour ? [armyRow(NEIGHBOUR_ARMY, NEIGHBOUR_HOME, neighbour)] : []),
      ].filter(({ value }) => owner === null || BigInt(STRUCTURE_OWNERS.get(value.owner)!) === BigInt(owner)),
    },
  ],
});

/** A confirmed shared Quarry held by a rival; the enrolled player's army stays outside the Deep. */
export interface DeepSiteFixture {
  troops: number;
  aspect: number;
  lore: boolean;
  lastTick: number;
  entered?: number;
}

export function siteSnapshot(
  base: HeraldGameSnapshot,
  site: DeepSiteFixture | null,
  owner?: string | null,
): HeraldGameSnapshot {
  if (!site) return base;
  const put = (model: string, rows: HeraldGameSnapshot["models"][number]["rows"]) => {
    const existing = base.models.find((row) => row.model === model);
    if (existing) existing.rows = rows;
    else base.models.push({ model, rows });
  };
  const row = (key: number, value: Record<string, unknown>) => ({
    key: `0x${key.toString(16)}`,
    value: { game_id: GAME_ID, ...value },
  });
  const bar = { amount: 120, settledAt: Math.floor(Date.now() / 1000), day: TODAY };
  const armies = [armyRow(ARMY, HOME, bar), armyRow(NEIGHBOUR_ARMY, NEIGHBOUR_HOME, bar)];
  armies[0]!.value.troops.count = String(1500 * RESOURCE_PRECISION);
  armies[1]!.value.troops.count = String(site.troops * RESOURCE_PRECISION);
  put("ExplorerTroops", armies);
  put(
    "Structure",
    [HOME, NEIGHBOUR_HOME].map((home) => row(home, realmRow(home))),
  );
  put("ArmySlot", [armySlotRow(ARMY, HOME, bar), armySlotRow(NEIGHBOUR_ARMY, NEIGHBOUR_HOME, bar)]);
  put("ArmyProgress", [armyProgressRow(ARMY, HOME), armyProgressRow(NEIGHBOUR_ARMY, NEIGHBOUR_HOME)]);
  put("ArmyCombat", [armyCombatRow(ARMY), armyCombatRow(NEIGHBOUR_ARMY)]);
  put(
    "ArmyDay",
    [ARMY, NEIGHBOUR_ARMY].map((explorer_id) => row(explorer_id, { explorer_id, day: TODAY })),
  );
  put("HomeAspect", [
    row(HOME, { home: HOME, aspect: 1 }),
    row(NEIGHBOUR_HOME, { home: NEIGHBOUR_HOME, aspect: site.aspect }),
  ]);
  put("RealmKnowledge", [row(HOME, { structure_id: HOME, learned: site.lore ? String(3n << 48n) : "0" })]);
  const offsets = {
    foundation: { x: 10, y: 25 },
    core: { x: 25, y: 10 },
    mine: { x: 25, y: 25 },
    altar: { x: 40, y: 25 },
  } satisfies Record<(typeof deepSites)[number]["key"], { x: number; y: number }>;
  put("DeepRules", [
    row(1, {
      gate_distance: 4,
      rings:
        site.entered === undefined
          ? [{ radius: 5, realms: 0 }]
          : [
              { radius: 5, realms: 0 },
              { radius: 8, realms: 1 },
            ],
      beasts: deepSites.map((_, kind) => ({ count: 10000 * RESOURCE_PRECISION, bow: kind % 2 === 1 })),
      loss_per_tick: frontierSeasonOnePreset.deep.lossPerTick * RESOURCE_PRECISION,
      core_per_tick: 500 * RESOURCE_PRECISION,
      mine_per_tick: 500 * RESOURCE_PRECISION,
      building_pay: { alone: 6, pair: 3, crowd: 2 },
      altar_threshold: 1500,
    }),
  ]);
  const rings = site.entered === undefined ? [0] : [0, 1];
  const ringKinds = [...deepSites, ...deepSites.slice(0, nativeRuleConstants.DEEP_RING_SITES - deepSites.length)];
  const sites = rings.flatMap((ring) =>
    ringKinds.map((kind, place) => ({
      ring,
      kind,
      id: 800 + 100 * ring + place,
      at: place < deepSites.length ? offsets[kind.key] : { x: 10 + 30 * (place - deepSites.length), y: 10 },
    })),
  );
  const mine = deepSites.find((kind) => kind.key === "mine")!;
  const held = 800 + mine.id;
  put(
    "DeepSite",
    sites.map(({ ring, kind, id }) =>
      row(id, { entity_id: id, kind: kind.id, ring, day: TODAY, aspect: id === held ? site.aspect : 0 }),
    ),
  );
  put("DeepEntries", site.entered === undefined ? [] : [row(2, { day: TODAY, count: site.entered })]);
  put("GarrisonSlot", [row(held, { structure_id: held, slot: 1, home: NEIGHBOUR_HOME })]);
  put("DeepTick", [row(1, { paid_tick: site.lastTick })]);
  put("DeepArmy", [row(NEIGHBOUR_ARMY, { explorer_id: NEIGHBOUR_ARMY, last_tick: site.lastTick })]);
  put("TileOccupancy", [
    armyPosition(ARMY, HOME, bar),
    ...sites.map(({ ring, id, at }) =>
      row(id, {
        entity_id: id,
        col: at.x + 25,
        row: at.y + 325 + 3 * ring,
        alt: false,
        category: TileOccupier.DeepSite,
        is_structure: false,
      }),
    ),
  ]);
  const guard = (id: number, slot: number, count: number) =>
    row(id * 4 + slot, {
      structure_id: id,
      slot,
      destroyed_tick: 0,
      troops: {
        ...explorerFixture.expected.value.troops,
        stamina: { Inline: { amount: 120, settled_at: bar.settledAt, remainder: 0 } },
        count,
      },
    });
  put("Guard", [
    ...sites.map(({ id }) => guard(id, 0, id === held ? 0 : 10000 * RESOURCE_PRECISION)),
    guard(held, 1, site.troops * RESOURCE_PRECISION),
  ]);
  const rules = base.models.find(({ model }) => model === "SliceRules")!.rows[0]!.value;
  rules.battle_config = { ...release.definition.rules.battle_config, cooldown_seconds: 0 };
  if (!owner) return base;
  const homes = new Set(
    [...STRUCTURE_OWNERS].filter(([, account]) => BigInt(account) === BigInt(owner)).map(([home]) => BigInt(home)),
  );
  return {
    ...base,
    models: base.models.map(({ model, rows }) => ({
      model,
      rows: rows.filter(
        ({ value }) =>
          value.owner === undefined ||
          BigInt(value.owner as string) === BigInt(owner) ||
          homes.has(BigInt(value.owner as string)),
      ),
    })),
  };
}

const realmRow = (home: number) => ({
  game_id: GAME_ID,
  entity_id: home,
  owner: STRUCTURE_OWNERS.get(home)!,
  base: {
    troop_max_guard_count: 1,
    troop_max_explorer_count: 1,
    created_at: SEASON_START,
    category: 1,
    level: 0,
    starting_troops_granted: true,
  },
  resources_packed: "0x0",
  metadata: {
    realm_id: home === HOME ? 711 : 712,
    order: 0,
    has_wonder: false,
    village_realm: "0x0",
    mine_kind: 0,
    deepest_depth: 0,
  },
});

const armyRow = (explorerId: number, home: number, _army: ArmyState, slot = 0) => ({
  key: `0x${explorerId.toString(16)}`,
  value: {
    ...explorerFixture.expected.value,
    game_id: GAME_ID,
    explorer_id: explorerId,
    owner: home,
    troops: {
      ...explorerFixture.expected.value.troops,
      count: "0x64",
      stamina: { Slot: slot },
    },
  },
});

const armyCombatRow = (explorerId: number) => ({
  key: `0x${explorerId.toString(16)}`,
  value: { game_id: GAME_ID, explorer_id: explorerId, last_target: 0 },
});

const armyProgressRow = (explorerId: number, home: number) => ({
  home,
  key: `0x${explorerId.toString(16)}`,
  value: {
    game_id: GAME_ID,
    explorer_id: explorerId,
    logistics: 0,
    oath_slots: 1,
    oaths: 0,
    oath_pick: 0,
  },
});

const armySlotRow = (explorerId: number, home: number, army: ArmyState, slot = 0) => ({
  key: `0x${(home * 16 + slot).toString(16)}`,
  value: {
    game_id: GAME_ID,
    structure_id: home,
    epoch: army.day,
    slot,
    explorer_id: explorerId,
    stamina: { amount: army.amount, settled_at: army.settledAt, remainder: 0 },
  },
});

/** An army's tile: in the region of the day it marched out on, the `step`th tile east of the realm's region middle. */
const armyPosition = (explorerId: number, home: number, army: ArmyState, step = 0) => ({
  home,
  key: `0x${explorerId.toString(16)}`,
  value: {
    game_id: GAME_ID,
    alt: false,
    col: (home === HOME ? 0 : REGION_SPACING) + REGION_SPACING / 2 + step,
    row: (army.mapDay ?? army.day) * 4 * REGION_SPACING + REGION_SPACING / 2,
    entity_id: explorerId,
    category: 15,
    is_structure: false,
  },
});
