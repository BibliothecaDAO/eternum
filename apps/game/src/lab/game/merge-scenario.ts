import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { type LabCommand, type LabFact, type LabScenario, wire } from "./lab-chain";
import { armyProgress, besideOnOpenLand, PROGRESS_KEYS, progressionRules, spireScenario } from "./spire-scenario";

/** The realm's second army, beside its first. */
const MERGE_ARMY = 202;
/** The second army's troops, at the chain's precision: with the spire's 1,498 they make the owner's 4,015. */
const SECOND_ARMY_TROOPS = 2_517_000_000_000n;
/** The realm's army limit raised from the fixture's 1,500 to 4,500, as a grown realm's is, so the two can merge. */
const LIMIT_RAISED = 3;

/**
 * Which army a full merge keeps: the army picked (the source, when it has more progression; today's rule, troops.cairo
 * `source_wins_merge`), or the army tapped (the merged-into army: today when it has as much progression or more, and
 * always from release 3).
 */
type Survivor = "picked" | "tapped";

/**
 * Two of realm 7's armies side by side on the spire's game (/lab/game?scenario=merge-keeps-picked or
 * merge-keeps-tapped): the spire's 1,498 knights and 2,517 more beside them, alike and within the realm's army limit
 * together, so they can merge. The chain answers their transfer as troops.cairo's transfer_troops applies it between two
 * explorers: a full merge keeps the army with more progression, the other is destroyed (its troops row and its tile's
 * occupancy deleted). The owner's merge on prod (2026-10-25: "due to an army merge I dont see the hover label") ended
 * with one army of 4,015.
 */
export const mergeScenario = (survivor: Survivor) => (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const [, occupancy] = [...store.entries("TileOccupancy")].find(([, row]) => row.entity_id === BigInt(SPIRE_ARMY))!;
  const beside = besideOnOpenLand(store, occupancy);
  const first = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  store.applyFacts([
    raisedArmyLimit(store),
    {
      model: "ExplorerTroops",
      key: "0x1ab90",
      value: wire({ ...first, explorer_id: MERGE_ARMY, troops: { ...first.troops, count: SECOND_ARMY_TROOPS } }),
    },
    {
      model: "TileOccupancy",
      key: "0x1ab91",
      value: wire({ ...occupancy, ...beside, entity_id: MERGE_ARMY }),
    },
    progressionRules(),
    // The picked army is the spire's; the more progressed army is the one a merge keeps.
    armyProgress(PROGRESS_KEYS.spireArmy, SPIRE_ARMY, survivor === "picked" ? 100 : 0),
    armyProgress("0x1ab93", MERGE_ARMY, survivor === "tapped" ? 100 : 0),
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) => answerTransfer(command, chain) ?? spire.answer(command, chain, now),
  };
};

/** The spire's rules (written under the key the spire scenario gives them) with T1 armies held to a larger limit. */
const raisedArmyLimit = (store: NativeFactStore): LabFact => {
  const rules = wire(store.require("SliceRules", { game_id: 1 })) as {
    troop_limit_config: { t1_tier_modifier: number };
  };
  const limit = rules.troop_limit_config;
  return {
    model: "SliceRules",
    key: "0x100",
    value: { ...rules, troop_limit_config: { ...limit, t1_tier_modifier: limit.t1_tier_modifier * LIMIT_RAISED } },
  };
};

/** ManageTroops::Transfer (troop_management.cairo's fifth variant). */
const TRANSFER = 4n;

/**
 * A ManageTroops Transfer between two explorers, as its span reads: [command, Transfer, Explorer, source, Explorer,
 * target, amount]; null for any other troop command.
 */
const readTransfer = (command: LabCommand) => {
  if (command.kind !== "ManageTroops") return null;
  const [, variant, sourceVariant, source, targetVariant, target, amount] = command.calldata.slice(4).map(BigInt);
  if (variant !== TRANSFER || sourceVariant !== 0n || targetVariant !== 0n) return null;
  return { source, target, amount };
};

/**
 * troops.cairo's transfer_troops between two explorers: a full merge goes into the army with more progression, the
 * emptied army is destroyed (destroy_explorer: its row deleted, its tile vacated), and the other holds the troops.
 */
const answerTransfer = (command: LabCommand, chain: NativeFactStore): LabFact[] | null => {
  const transfer = readTransfer(command);
  if (!transfer) return null;
  const army = (id: bigint) => [...chain.entries("ExplorerTroops")].find(([, row]) => row.explorer_id === id)!;
  const value = (id: bigint) => chain.get("ArmyProgress", { game_id: 1, explorer_id: id })?.xp ?? 0;
  let [source, target, amount] = [transfer.source, transfer.target, transfer.amount];
  const [, sourceRow] = army(source);
  if (amount === sourceRow.troops.count && value(source) > value(target)) {
    amount = army(target)[1].troops.count;
    [source, target] = [target, source];
  }
  const [sourceKey, from] = army(source);
  const [targetKey, to] = army(target);
  const left = from.troops.count - amount;
  const holding = {
    model: "ExplorerTroops",
    key: targetKey,
    value: wire({ ...to, troops: { ...to.troops, count: to.troops.count + amount } }),
  };
  if (left > 0n)
    return [
      { model: "ExplorerTroops", key: sourceKey, value: wire({ ...from, troops: { ...from.troops, count: left } }) },
      holding,
    ];
  const [vacatedKey] = [...chain.entries("TileOccupancy")].find(([, row]) => row.entity_id === source)!;
  return [
    { model: "TileOccupancy", key: vacatedKey, value: null },
    { model: "ExplorerTroops", key: sourceKey, value: null },
    holding,
  ];
};
