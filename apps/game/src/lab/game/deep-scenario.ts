import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { learnResearch, researchTier } from "@bibliothecadao/eternum";
import {
  deepCenter,
  nativeRuleConstants,
  nativeResearchConstants,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { deepSites, RESOURCE_PRECISION, TileOccupier } from "@bibliothecadao/types";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { type LabFact, type LabScenario, wire } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

export const HELD_SITE = "altar" satisfies (typeof deepSites)[number]["key"];

export const deepScenario = (closedRing = false): LabScenario => {
  const scenario = spireScenario();
  const { store, startsAt } = scenario;
  const spacing = store.require("SettlementRules", { game_id: 1 }).spacing;
  const center = deepCenter(spacing);
  const half = nativeRuleConstants.DEEP_MAP_SIZE / 2;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: SPIRE_ARMY });
  const home = store.require("Structure", { game_id: 1, entity_id: army.owner });
  const slice = store.require("SliceRules", { game_id: 1 });
  const tickSeconds = Number(slice.tick_config.armies_tick_in_seconds);
  const tick = Math.floor(startsAt / tickSeconds);
  const slot = store.require("ArmySlot", { game_id: 1, structure_id: army.owner, epoch: 0n, slot: 0 });
  const at = store.entityOccupancy(1, SPIRE_ARMY)!;
  const [allyHome, fieldAlly] = [9n, 399n];
  const local = {
    foundation: { x: 18, y: 25 },
    core: { x: 25, y: 18 },
    mine: { x: 32, y: 25 },
    altar: { x: 25, y: 25 },
  } satisfies Record<(typeof deepSites)[number]["key"], { x: number; y: number }>;
  const rules = seasonOneDeepRules(closedRing);
  const facts: LabFact[] = [
    {
      model: "ExplorerTroops",
      key: store.wireKeyOf("ExplorerTroops", army)!,
      value: wire({ ...army, troops: { ...army.troops, stamina: { Slot: 0 } } }),
    },
    {
      model: "ArmySlot",
      key: store.wireKeyOf("ArmySlot", slot)!,
      value: wire({
        ...slot,
        explorer_id: army.explorer_id,
        stamina: { amount: 40n, settled_at: startsAt - tickSeconds, remainder: 0 },
      }),
    },
    { model: "DeepRules", key: "0xdee0", value: wire(rules) },
    { model: "HomeAspect", key: "0xdee1", value: { game_id: 1, home: String(home.entity_id), aspect: 1 } },
    { model: "HomeAspect", key: "0xdee2", value: { game_id: 1, home: String(allyHome), aspect: 1 } },
    { model: "Structure", key: "0xdee3", value: wire({ ...home, entity_id: allyHome, owner: "0x222" }) },
    { model: "DeepArmy", key: "0xdee7", value: { game_id: 1, explorer_id: SPIRE_ARMY, last_tick: String(tick) } },
    { model: "DeepTick", key: "0xdee4", value: { game_id: 1, paid_tick: String(tick) } },
    {
      model: "GarrisonSlot",
      key: "0xdee8",
      value: { game_id: 1, structure_id: String(siteId(HELD_SITE)), slot: 1, home: String(allyHome) },
    },
    {
      model: "Guard",
      key: "0xdee5",
      value: wire({ game_id: 1, structure_id: siteId(HELD_SITE), slot: 1, troops: army.troops, destroyed_tick: 0 }),
    },
    { model: "TileOccupancy", key: store.wireKeyOf("TileOccupancy", at)!, value: null },
    { model: "TileOccupancy", key: "0xdee9", value: wire({ ...at, col: center.col - 1, row: center.row }) },
    // A second ally, in the field beside the player's army: it is drawn as an ally, not as a guard.
    { model: "ExplorerTroops", key: "0xdef1", value: wire({ ...army, explorer_id: fieldAlly, owner: allyHome }) },
    { model: "ArmyDay", key: "0xdef2", value: { game_id: 1, explorer_id: String(fieldAlly), day: "0" } },
    {
      model: "ArmyProgress",
      key: "0xdef4",
      value: wire({
        ...store.require("ArmyProgress", { game_id: 1, explorer_id: SPIRE_ARMY }),
        explorer_id: fieldAlly,
      }),
    },
    {
      model: "TileOccupancy",
      key: "0xdef3",
      value: wire({ ...at, entity_id: fieldAlly, col: center.col - 3, row: center.row - 1 }),
    },
  ];
  const ring = [
    ...deepSites.map((site) => ({ site, offset: local[site.key] })),
    ...deepSites
      .slice(0, nativeRuleConstants.DEEP_RING_SITES - deepSites.length)
      .map((site, extra) => ({ site, offset: { x: 11 + 28 * extra, y: 25 } })),
  ];
  for (const [place, { site, offset }] of ring.entries()) {
    const beast = rules.beasts[site.id]!;
    const entityId = BigInt(800 + place);
    facts.push(
      {
        model: "DeepSite",
        key: `0xdeea${place}`,
        value: {
          game_id: 1,
          entity_id: String(entityId),
          kind: site.id,
          ring: 0,
          day: "0",
          aspect: site.key === HELD_SITE && place < deepSites.length ? 1 : 0,
        },
      },
      {
        model: "TileOccupancy",
        key: `0xdeeb${place}`,
        value: {
          game_id: 1,
          entity_id: String(entityId),
          col: center.col + offset.x - half,
          row: center.row + offset.y - half,
          alt: false,
          category: TileOccupier.DeepSite,
          is_structure: false,
        },
      },
      {
        model: "Guard",
        key: `0xdeec${place}`,
        value: wire({
          game_id: 1,
          structure_id: entityId,
          slot: 0,
          troops: {
            ...army.troops,
            category: beast.bow ? "Crossbowman" : "Knight",
            count: site.key === HELD_SITE && place < deepSites.length ? 0n : beast.count,
          },
          destroyed_tick: 0,
        }),
      },
    );
  }
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: army.owner });
  let learned = knowledge.learned;
  while (researchTier(learned, nativeResearchConstants.ROW_LORE) < nativeResearchConstants.LORE_SPIRES)
    learned = learnResearch(learned, nativeResearchConstants.ROW_LORE);
  facts.push({
    model: "RealmKnowledge",
    key: store.wireKeyOf("RealmKnowledge", knowledge)!,
    value: wire({ ...knowledge, learned }),
  });
  store.applyFacts(facts as never);
  return {
    ...scenario,
    opensOn: center,
    answer: () => [],
  };
};

const siteId = (key: (typeof deepSites)[number]["key"]): bigint =>
  BigInt(800 + deepSites.find((site) => site.key === key)!.id);

const scaled = (amount: number): bigint => BigInt(amount) * BigInt(RESOURCE_PRECISION);

const seasonOneDeepRules = (closedRing: boolean): NativeRows["DeepRules"] => {
  const deep = frontierSeasonOnePreset.deep;
  const [first, second] = deep.rings;
  return {
    game_id: 1,
    gate_distance: deep.gateDistance,
    rings: [{ radius: first.radius, realms: closedRing ? second.realms : first.realms }],
    beasts: deepSites.map(({ key }) => ({ count: scaled(deep.beasts[key].count), bow: deep.beasts[key].bow })),
    loss_per_tick: scaled(deep.lossPerTick),
    core_per_tick: scaled(deep.corePerTick),
    mine_per_tick: scaled(deep.minePerTick),
    building_pay: deep.buildingPay,
    altar_threshold: deep.altarThreshold,
  };
};
