import { learnResearch } from "@bibliothecadao/eternum";
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

/** A shared Deep snapshot after an ally cleared the Quarry; the player's army can join its next slot. */
export const deepScenario = (): LabScenario => {
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
  const [allyHome, allyArmy, fieldAlly] = [9n, 301n, 399n];
  const local = {
    foundation: { x: 10, y: 25, alt: false },
    quarry: { x: 25, y: 25, alt: false },
    altar: { x: 40, y: 25, alt: false },
  };
  const rules: NativeRows["DeepRules"] = {
    game_id: 1,
    ...local,
    beast_count: 10_000n * BigInt(RESOURCE_PRECISION),
    loss_per_tick: 200n * BigInt(RESOURCE_PRECISION),
    quarry_per_tick: 500n * BigInt(RESOURCE_PRECISION),
    altar_per_tick: 5,
    altar_threshold: 1500,
  };
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
    { model: "ExplorerTroops", key: "0xdee4", value: wire({ ...army, explorer_id: allyArmy, owner: allyHome }) },
    { model: "ArmyCombat", key: "0xded4", value: wire({ game_id: 1, explorer_id: allyArmy, charge: 0, last_target: 0 }) },
    { model: "ArmyDay", key: "0xdee5", value: { game_id: 1, explorer_id: String(allyArmy), day: "0" } },
    { model: "DeepArmy", key: "0xdee6", value: { game_id: 1, explorer_id: String(allyArmy), last_tick: String(tick) } },
    { model: "DeepArmy", key: "0xdee7", value: { game_id: 1, explorer_id: SPIRE_ARMY, last_tick: String(tick) } },
    {
      model: "DeepGuard",
      key: "0xdee8",
      value: { game_id: 1, explorer_id: String(allyArmy), site_id: String(siteId("quarry")), slot: 0 },
    },
    { model: "TileOccupancy", key: store.wireKeyOf("TileOccupancy", at)!, value: null },
    { model: "TileOccupancy", key: "0xdee9", value: wire({ ...at, col: center.col - 1, row: center.row }) },
    // The player's army is four fifths of the way to its first skill point: its portrait's ring is four fifths filled.
    {
      model: "ArmyProgress",
      key: store.wireKeyOf("ArmyProgress", { game_id: 1, explorer_id: SPIRE_ARMY })!,
      value: wire({
        ...store.require("ArmyProgress", { game_id: 1, explorer_id: SPIRE_ARMY }),
        xp: store.require("ArmyProgressionRules", { game_id: 1 }).common_xp * 0.8,
      }),
    },
    // A second ally, in the field beside the player's army: it is drawn as an ally, not as a guard.
    { model: "ExplorerTroops", key: "0xdef1", value: wire({ ...army, explorer_id: fieldAlly, owner: allyHome }) },
    { model: "ArmyDay", key: "0xdef2", value: { game_id: 1, explorer_id: String(fieldAlly), day: "0" } },
    {
      model: "TileOccupancy",
      key: "0xdef3",
      value: wire({ ...at, entity_id: fieldAlly, col: center.col - 3, row: center.row - 1 }),
    },
  ];
  for (const site of deepSites) {
    const offset = local[site.position];
    facts.push(
      {
        model: "DeepSite",
        key: `0xdeea${site.id}`,
        value: { game_id: 1, entity_id: String(siteId(site.position)), kind: site.id, day: "0" },
      },
      {
        model: "TileOccupancy",
        key: `0xdeeb${site.id}`,
        value: {
          game_id: 1,
          entity_id: String(siteId(site.position)),
          col: center.col + offset.x - half,
          row: center.row + offset.y - half,
          alt: false,
          category: TileOccupier.DeepSite,
          is_structure: false,
        },
      },
      {
        model: "Guard",
        key: `0xdeec${site.id}`,
        value: wire({
          game_id: 1,
          structure_id: siteId(site.position),
          slot: 0,
          troops: { ...army.troops, count: site.position === "quarry" ? 0n : rules.beast_count },
          destroyed_tick: 0,
        }),
      },
    );
  }
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: army.owner });
  facts.push({
    model: "RealmKnowledge",
    key: store.wireKeyOf("RealmKnowledge", knowledge)!,
    value: wire({ ...knowledge, learned: learnResearch(knowledge.learned, nativeResearchConstants.ROW_DEPTH, 0) }),
  });
  store.applyFacts(facts as never);
  return {
    ...scenario,
    opensOn: center,
    answer: (command, chain) => {
      if (command.kind !== "InteractSite") return [];
      const [rawId, alt, x, y] = command.calldata.slice(5);
      if (rawId === undefined || alt === undefined || x === undefined || y === undefined) return [];
      if (BigInt(alt) !== 0n || BigInt(x) !== BigInt(center.col) || BigInt(y) !== BigInt(center.row)) return [];
      const explorer_id = BigInt(rawId);
      const location = chain.entityOccupancy(1, explorer_id);
      if (!location || explorer_id !== BigInt(SPIRE_ARMY)) return [];
      return [
        { model: "TileOccupancy", key: chain.wireKeyOf("TileOccupancy", location)!, value: null },
        {
          model: "DeepGuard",
          key: "0xdeed",
          value: { game_id: 1, explorer_id: String(explorer_id), site_id: String(siteId("quarry")), slot: 1 },
        },
      ];
    },
  };
};

const siteId = (position: (typeof deepSites)[number]["position"]): bigint =>
  BigInt(800 + deepSites.find((site) => site.position === position)!.id);
