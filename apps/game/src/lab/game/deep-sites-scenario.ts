import { readExpeditionRules, seasonDay } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { aspects, deepSites, StructureType, TileOccupier } from "@bibliothecadao/types";
import { nativeRuleConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { ARMY_DAY_KEY } from "@/ui/features/frontier/sites/site-fixture";
import { SPIRE_ARMY, SPIRE_DAY_NOW } from "@/ui/features/frontier/spire-fixture";

import { DEEP_SCALE_HYPERSTRUCTURE, ETHEREAL_DEPTH_SCENARIOS, etherealArmyTileKey } from "./ethereal-depths-scenario";
import { type LabCommand, type LabFact, type LabScenario, wire } from "./lab-chain";
import { besideOnOpenLand } from "./spire-scenario";

const PRECISION = 1_000_000_000n;
/** The depth proof's scale hyperstructure's rows (ethereal-depths-scenario.ts), which this game removes. */
const DEEP_SCALE_KEYS = [
  ["Structure", "0xef3"],
  ["Hyperstructure", "0xef4"],
  ["TileOccupancy", "0xef5"],
] as const;
const ARMY = BigInt(SPIRE_ARMY);
/** The Deep's three sites, by the catalog's key: their entity ids in this game. */
const SITE_IDS = { foundation: 0x1ac01n, quarry: 0x1ac02n, altar: 0x1ac03n } as const;
const [MIGHT, , CHAOS] = aspects;

/** The other players' homes standing in the Deep today: a mate in the player's Aspect, and two rivals. */
const OTHERS = [
  { home: 0x1ac11n, owner: "0x1ac21", aspect: MIGHT.id, army: 0x1ac31n, site: "foundation", slot: 0, troops: 6_000n },
  { home: 0x1ac12n, owner: "0x1ac22", aspect: CHAOS.id, army: 0x1ac32n, site: "altar", slot: 0, troops: 9_000n },
  { home: 0x1ac13n, owner: "0x1ac23", aspect: CHAOS.id, army: 0x1ac33n, site: "altar", slot: 1, troops: 3_000n },
] as const;

/** The race so far: each Aspect's hyperstructure height, four stages apart: Harmony 1, Might 2, Chaos 3, Guile 4. */
const HEIGHTS = { 1: 4_100, 2: 2_500, 3: 6_000, 4: 8_200 } as const;
/** The Glory each home has earned holding the Foundation or the Altar; the player's realm 7 and its mate in Might. */
const GLORY = [
  { home: 7n, glory: 120n },
  { home: OTHERS[0].home, glory: 340n },
  { home: OTHERS[1].home, glory: 410n },
] as const;
/** Chaos's bane bar, filled by its Altar ticks. */
const CHAOS_BAR = 600;

/**
 * The Deep's three sites on a Season 1 day (/lab/game?scenario=deep-sites), at Season 1's numbers: the realm's army in
 * the Deep beside the Foundation, which a mate of its Aspect (Might) holds with one army; the Quarry behind its beast;
 * the Altar held by two armies of Chaos. The race stands Guile at stage 4, Chaos 3, Might 2 (its first Triumph
 * fallen) and Harmony 1, their four towers in a row above the arrival, each holder's Glory and Chaos's bane bar part filled. The chain answers InteractSite on a Deep site as deep_guards.cairo `join`
 * does: the army takes the first free slot and leaves its tile. Every other command is the depth proof's.
 */
export const deepSitesScenario = (): LabScenario => {
  const scenario = ETHEREAL_DEPTH_SCENARIOS["ethereal-depths-3"]!();
  const { store } = scenario;
  const day = BigInt(seasonDay(readExpeditionRules(store, 1)!, SPIRE_DAY_NOW)!);
  const hyperstructure = store.entityOccupancy(1, DEEP_SCALE_HYPERSTRUCTURE)!;
  const arrival = { col: hyperstructure.col + 1, row: hyperstructure.row + 1 };
  const tick = BigInt(Math.floor(SPIRE_DAY_NOW / tickSeconds(store)));
  // The depth proof's lone hyperstructure stood for scale; here the four Aspects' towers do, and a fifth bare
  // foundation beside the Foundation would read as another site.
  store.applyFacts(DEEP_SCALE_KEYS.map(([model, key]) => ({ model, key, value: null })) as never);
  store.applyFacts([
    ...armyInTheDeep(store, arrival, day, tick),
    ...deepRules(),
    { model: "HomeAspect", key: "0x1ac40", value: wire({ game_id: 1, home: 7n, aspect: MIGHT.id }) },
  ] as never);
  const tiles = siteTiles(store, arrival);
  store.applyFacts([
    ...deepSites.flatMap((kind, index) => siteFacts(store, kind, index, tiles[kind.position], day)),
    ...OTHERS.flatMap((other, index) => guardFacts(store, other, index, day, tick)),
    ...raceFacts(day),
    ...aspectTowers(store, arrival),
  ] as never);
  return {
    ...scenario,
    opensOn: arrival,
    answer: (command, chain, now) =>
      command.kind === "InteractSite" && deepSiteAt(chain, command)
        ? joinDeepSite(command, chain)
        : scenario.answer(command, chain, now),
  };
};

/** The army's tile at the Deep's arrival, its day today and its first Deep tick now. */
const armyInTheDeep = (
  store: NativeFactStore,
  arrival: { col: number; row: number },
  day: bigint,
  tick: bigint,
): LabFact[] => {
  const tile = store.entityOccupancy(1, SPIRE_ARMY)!;
  return [
    { model: "TileOccupancy", key: etherealArmyTileKey(3), value: null },
    { model: "TileOccupancy", key: "0x1ac45", value: wire({ ...tile, ...arrival }) },
    { model: "ArmyDay", key: ARMY_DAY_KEY, value: wire({ game_id: 1, explorer_id: ARMY, day }) },
    {
      model: "DeepArmy",
      key: "0x1ac42",
      value: wire({ game_id: 1, explorer_id: ARMY, last_tick: tick }),
    },
  ];
};

/** Season 1's Deep and race numbers, from its preset. */
const deepRules = (): LabFact[] => {
  const { deep, race } = frontierSeasonOnePreset;
  if (!deep || !race) throw new Error("Season 1's preset has no Deep or race");
  const at = ({ x, y }: { x: number; y: number }) => ({ alt: false, x, y });
  const corner = (position: readonly [number, number] | undefined) => {
    if (!position) throw new Error("Season 1's race places four hyperstructures");
    return at({ x: position[0], y: position[1] });
  };
  return [
    {
      model: "DeepRules",
      key: "0x1ac43",
      value: wire({
        game_id: 1,
        foundation: at(deep.foundation),
        quarry: at(deep.quarry),
        altar: at(deep.altar),
        beast_count: BigInt(deep.beastCount) * PRECISION,
        loss_per_tick: BigInt(deep.lossPerTick) * PRECISION,
        quarry_per_tick: BigInt(deep.quarryPerTick) * PRECISION,
        altar_per_tick: deep.altarPerTick,
        altar_threshold: deep.altarThreshold,
      }),
    },
    {
      model: "RaceRules",
      key: "0x1ac44",
      value: wire({
        game_id: 1,
        season_days: BigInt(race.seasonDays),
        glory_per_tick: BigInt(race.gloryPerTick),
        height_per_tick: race.heightPerTick,
        stage_height: race.stageHeight,
        clear_mist_percent: race.clearMistPercent,
        second_wind_percent: race.secondWindPercent,
        pale_moon_percent: race.paleMoonPercent,
        spoils_percent: race.spoilsPercent,
        first: corner(race.positions[0]),
        second: corner(race.positions[1]),
        third: corner(race.positions[2]),
        fourth: corner(race.positions[3]),
      }),
    },
  ];
};

/** The Foundation beside the army; the Quarry and the Altar a few tiles off on the Deep's explored ground. */
const siteTiles = (store: NativeFactStore, arrival: { col: number; row: number }) => ({
  foundation: besideOnOpenLand(store, arrival),
  quarry: { col: arrival.col + 4, row: arrival.row },
  altar: { col: arrival.col - 4, row: arrival.row },
});

/** A site today: its row, its tile, and its beast: 10,000 at the Quarry, beaten at the two held sites. */
const siteFacts = (
  store: NativeFactStore,
  kind: (typeof deepSites)[number],
  index: number,
  tile: { col: number; row: number },
  day: bigint,
): LabFact[] => {
  const entity_id = SITE_IDS[kind.position];
  const troops = store.require("ExplorerTroops", { game_id: 1, explorer_id: ARMY }).troops;
  const beast = kind.position === "quarry" ? store.require("DeepRules", { game_id: 1 }).beast_count : 0n;
  return [
    { model: "DeepSite", key: `0x1ac5${index}`, value: wire({ game_id: 1, entity_id, kind: kind.id, day }) },
    {
      model: "TileOccupancy",
      key: `0x1ac6${index}`,
      value: wire({ game_id: 1, entity_id, category: TileOccupier.DeepSite, is_structure: false, alt: false, ...tile }),
    },
    {
      model: "Guard",
      key: `0x1ac7${index}`,
      value: wire({
        game_id: 1,
        structure_id: entity_id,
        slot: 0,
        destroyed_tick: 0,
        troops: { ...troops, count: beast },
      }),
    },
  ];
};

/** Another player's home, its Aspect, and its army in a site's slot since this tick. */
const guardFacts = (
  store: NativeFactStore,
  other: (typeof OTHERS)[number],
  index: number,
  day: bigint,
  tick: bigint,
): LabFact[] => {
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: ARMY });
  const explorer_id = other.army;
  return [
    {
      model: "Structure",
      key: `0x1ac8${index}`,
      value: wire({
        ...realm,
        entity_id: other.home,
        owner: BigInt(other.owner),
        metadata: { ...realm.metadata, realm_id: 100 + index },
      }),
    },
    { model: "HomeAspect", key: `0x1ac9${index}`, value: wire({ game_id: 1, home: other.home, aspect: other.aspect }) },
    {
      model: "ExplorerTroops",
      key: `0x1aca${index}`,
      value: wire({
        ...army,
        explorer_id,
        owner: other.home,
        troops: { ...army.troops, count: other.troops * PRECISION },
      }),
    },
    { model: "ArmyDay", key: `0x1acb${index}`, value: wire({ game_id: 1, explorer_id, day }) },
    { model: "DeepArmy", key: `0x1acc${index}`, value: wire({ game_id: 1, explorer_id, last_tick: tick }) },
    {
      model: "DeepGuard",
      key: `0x1acd${index}`,
      value: wire({ game_id: 1, explorer_id, site_id: SITE_IDS[other.site], slot: other.slot }),
    },
  ];
};

/** The race's facts: each Aspect's hyperstructure, Might's first Triumph today, the holders' Glory and Chaos's bar. */
const raceFacts = (day: bigint): LabFact[] => [
  ...aspects.map(({ id }, index) => ({
    model: "AspectHyperstructure",
    key: `0x1acf${index}`,
    value: wire({ game_id: 1, aspect: id, entity_id: 0x1ad00n + BigInt(id), height: HEIGHTS[id] }),
  })),
  {
    model: "TriumphDay",
    key: "0x1ad10",
    value: wire({ game_id: 1, aspect: MIGHT.id, stage: nativeRuleConstants.CLEAR_MIST_STAGE, day }),
  },
  ...GLORY.map(({ home, glory }, index) => ({
    model: "RaceMember",
    key: `0x1ad2${index}`,
    value: wire({ game_id: 1, entity_id: home, glory: glory * PRECISION, contribution: 0n }),
  })),
  { model: "AltarBar", key: "0x1ad30", value: wire({ game_id: 1, aspect: CHAOS.id, charge: CHAOS_BAR }) },
];

/** Each Aspect's hyperstructure, the entity its AspectHyperstructure names, in a row three tiles above the arrival. */
const aspectTowers = (store: NativeFactStore, arrival: { col: number; row: number }): LabFact[] => {
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  return aspects.flatMap(({ id }, index) => {
    const entity_id = 0x1ad00n + BigInt(id);
    const tile = { col: arrival.col - 3 + index * 2, row: arrival.row - 3 };
    return [
      {
        model: "Structure",
        key: `0x1ad4${index}`,
        value: wire({
          ...realm,
          entity_id,
          owner: 0n,
          base: { ...realm.base, category: StructureType.Hyperstructure, level: 0 },
          metadata: { ...realm.metadata, realm_id: 0, order: 0, has_wonder: false },
        }),
      },
      {
        model: "Hyperstructure",
        key: `0x1ad5${index}`,
        value: { game_id: 1, entity_id, stage: "Construction", access: "Public", seed: "0x1" },
      },
      {
        model: "TileOccupancy",
        key: `0x1ad6${index}`,
        value: wire({
          game_id: 1,
          alt: false,
          ...tile,
          entity_id,
          category: TileOccupier.Hyperstructure,
          is_structure: true,
        }),
      },
    ];
  });
};

const tickSeconds = (store: NativeFactStore) =>
  Number(store.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds);

/** InteractSite: [explorer, coord.alt, coord.x, coord.y]; the Deep site on that tile, if one stands there. */
const deepSiteAt = (chain: NativeFactStore, command: LabCommand) => {
  const [, , x, y] = command.calldata.slice(5).map((felt) => BigInt(felt));
  return [...chain.entries("TileOccupancy")].find(
    ([, row]) => row.category === TileOccupier.DeepSite && BigInt(row.col) === x && BigInt(row.row) === y,
  )?.[1];
};

/**
 * The army takes the site's first free slot and leaves its field tile, as deep_guards.cairo `join` writes it; nothing
 * where `available_slot` refuses: a site another Aspect holds, a player's second army, four guards.
 */
const joinDeepSite = (command: LabCommand, chain: NativeFactStore): LabFact[] => {
  const [explorerId] = command.calldata.slice(5).map((felt) => BigInt(felt));
  const site = deepSiteAt(chain, command)!;
  const home = (explorer_id: bigint) => chain.require("ExplorerTroops", { game_id: 1, explorer_id }).owner;
  const aspect = (explorer_id: bigint) => chain.require("HomeAspect", { game_id: 1, home: home(explorer_id) }).aspect;
  const player = (explorer_id: bigint) =>
    chain.require("Structure", { game_id: 1, entity_id: home(explorer_id) }).owner;
  const guards = [...chain.entries("DeepGuard")].map(([, row]) => row).filter((row) => row.site_id === site.entity_id);
  const refused = guards.some(
    (guard) => aspect(guard.explorer_id) !== aspect(explorerId) || player(guard.explorer_id) === player(explorerId),
  );
  const slot = [0, 1, 2, 3].find((each) => !guards.some((guard) => guard.slot === each));
  if (refused || slot === undefined) return [];
  const [tileKey] = [...chain.entries("TileOccupancy")].find(([, row]) => row.entity_id === explorerId)!;
  return [
    { model: "TileOccupancy", key: tileKey, value: null },
    {
      model: "DeepGuard",
      key: `0x1ace${explorerId.toString(16)}`,
      value: wire({ game_id: 1, explorer_id: explorerId, site_id: site.entity_id, slot }),
    },
  ];
};
