import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { getNeighborHexes } from "@bibliothecadao/types";

import type { LabCommand, LabFact, LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** The realm's second army, beside its first. */
export const MERGE_ARMY = 202;
/** The second army's troops, at the chain's precision: the first holds 1,498. */
const SECOND_ARMY_TROOPS = 2_517_000_000_000n;

/**
 * Which army a full merge keeps: the army picked (the source, when it has more progression; today's rule, troops.cairo
 * `source_wins_merge`), or the army tapped (the merged-into army: today when it has as much progression or more, and
 * always from release 3).
 */
type Survivor = "picked" | "tapped";

const wire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));

/**
 * Two of realm 7's armies side by side on the spire's game (/lab/game?scenario=merge-keeps-picked or
 * merge-keeps-tapped): the spire's 1,498 knights and 2,517 more beside them, alike, so they can merge. The chain
 * answers TransferTroops as troops.cairo's transfer_troops applies it between two explorers: a full merge keeps the
 * army with more progression, the other is destroyed (its troops row and its tile's occupancy deleted). The owner's
 * merge on prod (2026-10-25: "due to an army merge I dont see the hover label") ended with one army of 4,015.
 */
export const mergeScenario = (survivor: Survivor) => (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const [, occupancy] = [...store.entries("TileOccupancy")].find(([, row]) => row.entity_id === BigInt(SPIRE_ARMY))!;
  const beside = besideOnOpenLand(store, occupancy);
  const first = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  store.applyFacts([
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
    armyProgress("0x1ab92", SPIRE_ARMY, survivor === "picked" ? 100 : 0),
    armyProgress("0x1ab93", MERGE_ARMY, survivor === "tapped" ? 100 : 0),
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) => answerTransfer(command, chain) ?? spire.answer(command, chain, now),
  };
};

/** A tile beside the army, revealed and empty, where its second army stands. */
const besideOnOpenLand = (store: NativeFactStore, army: { col: number; row: number }) => {
  const taken = new Set([...store.entries("TileOccupancy")].map(([, row]) => `${row.col},${row.row}`));
  const open = getNeighborHexes(army.col, army.row).find(
    (hex) =>
      !taken.has(`${hex.col},${hex.row}`) &&
      store.get("TileOpt", { game_id: 1, alt: false, col: hex.col, row: hex.row }),
  );
  if (!open) throw new Error("The lab finds no open tile beside the spire's army");
  return { col: open.col, row: open.row };
};

const progressionRules = (): LabFact => ({
  model: "ArmyProgressionRules",
  key: "0x1ab94",
  value: { game_id: 1, reveal_xp: 1, fixed_xp: 1, uncommon_xp: 2, rare_xp: 3, epic_xp: 4, legendary_xp: 5 },
});

const armyProgress = (key: string, explorerId: number, xp: number): LabFact => ({
  model: "ArmyProgress",
  key,
  value: {
    game_id: 1,
    explorer_id: String(explorerId),
    xp,
    battle: 1,
    logistics: 1,
    scouting: 1,
    scouting_kinds: 0,
    homecoming: 1,
  },
});

/** A TransferTroops between two explorers, as its span reads: [command, Explorer, source, Explorer, target, amount]. */
const readTransfer = (command: LabCommand) => {
  const [, sourceVariant, source, targetVariant, target, amount] = command.calldata.slice(4).map(BigInt);
  if (sourceVariant !== 0n || targetVariant !== 0n) return null;
  return { source, target, amount };
};

/**
 * troops.cairo's transfer_troops between two explorers: a full merge goes into the army with more progression, the
 * emptied army is destroyed (destroy_explorer: its row deleted, its tile vacated), and the other holds the troops.
 */
const answerTransfer = (command: LabCommand, chain: NativeFactStore): LabFact[] | null => {
  if (command.kind !== "TransferTroops") return null;
  const transfer = readTransfer(command);
  if (!transfer) return [];
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
