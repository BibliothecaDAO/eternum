import { DEPLOY_SLOT_KEY } from "@/ui/features/frontier/deploy/deploy-fixture";
import { SKILL_POINT_FIELDS } from "@bibliothecadao/eternum";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { TileOccupier } from "@bibliothecadao/types";

import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerTroops, wellRefillStamina } from "@bibliothecadao/eternum/troop-stamina";
import { type LabCommand, type LabFact, type LabScenario, wire } from "./lab-chain";
import { armyProgress, besideOnOpenLand, PROGRESS_KEYS, spireScenario } from "./spire-scenario";

/**
 * The army reaches the sites with room for a Well refill and a discovered III point.
 */
const STAMINA = 40n;
const XP = 40;

/**
 * The spire's army with a Well and a Shrine on open land beside it (/lab/game?scenario=sites): select it and tap
 * either, and its card offers Use. Its bar is part spent and it holds some XP, so what a use gives it shows.
 */
export const sitesScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const [, slot] = [...store.entries("ArmySlot")].find(([, row]) => row.structure_id === army.owner && row.slot === 0)!;
  store.applyFacts([
    {
      model: "ExplorerTroops",
      key: "0x74",
      value: wire({
        ...army,
        troops: { ...army.troops, stamina: { Slot: 0 } },
      }),
    },
    armyProgress(PROGRESS_KEYS.spireArmy, SPIRE_ARMY, XP),
    {
      model: "ArmySlot",
      key: DEPLOY_SLOT_KEY,
      value: wire({
        ...slot,
        explorer_id: SPIRE_ARMY,
        stamina: { amount: STAMINA, settled_at: spire.startsAt, remainder: 0 },
      }),
    },
  ] as never);
  const progress = store.require("ArmyProgress", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  store.applyFacts([
    { model: "ArmyProgress", key: PROGRESS_KEYS.spireArmy, value: wire({ ...progress, logistics: 3 }) },
  ] as never);
  const stands = store.entityOccupancy(1, SPIRE_ARMY)!;
  for (const [index, category] of [TileOccupier.Well, TileOccupier.Shrine].entries()) {
    const tile = besideOnOpenLand(store, stands);
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: `0x1af0${index}`,
        value: { game_id: 1, alt: false, ...tile, entity_id: 951 + index, category, is_structure: false },
      },
    ] as never);
  }
  store.applyFacts([
    { model: "ShrineReward", key: "0x1af10", value: { game_id: 1, entity_id: 952, rank: 3 } },
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "InteractSite" ? answerSiteUse(command, chain, now) : spire.answer(command, chain, now),
  };
};

/** What stands on a tile with no structure (a Shrine, a Well, a chest), as its occupancy row. */
export const siteAt = (
  key: string,
  tile: { col: number; row: number },
  entity: number,
  category: TileOccupier,
): LabFact => ({
  model: "TileOccupancy",
  key,
  value: { game_id: 1, alt: false, col: tile.col, row: tile.row, entity_id: entity, category, is_structure: false },
});

/** InteractSite: [explorer, coord.alt, coord.x, coord.y]. */
const answerSiteUse = (command: LabCommand, chain: NativeFactStore, now: number): LabFact[] => {
  const [explorerId, , x, y] = command.calldata.slice(5).map((felt) => BigInt(felt));
  const [siteKey, site] = [...chain.entries("TileOccupancy")].find(
    ([, row]) => BigInt(row.col) === x && BigInt(row.row) === y,
  )!;
  const vacated: LabFact = { model: "TileOccupancy", key: siteKey, value: null };
  if (site.category === TileOccupier.Shrine) return [vacated, ...shrinePoint(chain, explorerId, site.entity_id)];
  return [vacated, wellStamina(chain, explorerId, now)];
};

const shrinePoint = (chain: NativeFactStore, explorerId: bigint, siteId: bigint): LabFact[] => {
  const [key, progress] = [...chain.entries("ArmyProgress")].find(([, row]) => row.explorer_id === explorerId)!;
  const [rewardKey, reward] = [...chain.entries("ShrineReward")].find(([, row]) => row.entity_id === siteId)!;
  const field = SKILL_POINT_FIELDS[reward.rank - 1];
  if (!field) throw new Error(`Invalid Shrine rank ${reward.rank}`);
  return [
    { model: "ArmyProgress", key, value: wire({ ...progress, [field]: progress[field] + 1 }) },
    { model: "ShrineReward", key: rewardKey, value: null },
  ];
};

/** A Well's stamina, held to the army's bar as grant_stamina clamps it. */
const wellStamina = (chain: NativeFactStore, explorerId: bigint, now: number): LabFact => {
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: explorerId });
  const maximum = resolveExplorerTroops(chain, army)?.staminaMax;
  if (maximum === undefined) throw new Error("A Well refill needs its army's maximum stamina");
  const [key, slot] = [...chain.entries("ArmySlot")].find(([, row]) => row.explorer_id === explorerId)!;
  const amount = Math.min(maximum, Number(slot.stamina.amount) + wellRefillStamina(maximum));
  return { model: "ArmySlot", key, value: wire({ ...slot, stamina: { amount, settled_at: now, remainder: 0 } }) };
};
