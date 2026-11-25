import { reinforcementSource } from "@/ui/features/frontier/army/reinforce-plan";
import { SPIRE_ARMY, SPIRE_ARMY_TILE_KEY, SPIRE_DAY_NOW } from "@/ui/features/frontier/spire-fixture";
import {
  expeditionSpireTile,
  getTroopResourceId,
  readExpeditionRules,
  readTroopRaiseCost,
} from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { getNeighborHexes, RealmLevels, RESOURCE_PRECISION, type TroopTier, type TroopType } from "@bibliothecadao/types";

import { type LabCommand, type LabFact, type LabScenario, wire } from "./lab-chain";
import { raisedArmyLimit } from "./merge-scenario";
import { balancesPaid, spireScenario } from "./spire-scenario";

/**
 * The spire's game with realm 7's 1,498 knights standing beside the realm's home today, under a raised army limit
 * (/lab/game?scenario=reinforce), where the realm reinforces them from its stock: the realm selected, the army
 * right-clicked (a phone holds it). The chain answers RecruitExplorer as troops.cairo's recruit_explorer applies it:
 * the army holds the troops added, and the realm pays them from its stock of the army's own troop and their raise.
 */
export const reinforceScenario = (): LabScenario => {
  const game = spireScenario();
  const { store, opensOn: home } = game;
  const occupancy = store.entityOccupancy(1, SPIRE_ARMY)!;
  // Beside home and off the spire's tile, which the home ring also holds.
  const spire = expeditionSpireTile(
    readExpeditionRules(store, 1)!,
    store.require("Structure", { game_id: 1, entity_id: 7 }),
    SPIRE_DAY_NOW,
  )!;
  const beside = getNeighborHexes(home.col, home.row).find(
    (hex) =>
      (hex.col !== spire.col || hex.row !== spire.row) &&
      !store.get("TileOccupancy", { game_id: 1, alt: false, col: hex.col, row: hex.row }),
  )!;
  store.applyFacts([
    { model: "TileOccupancy", key: SPIRE_ARMY_TILE_KEY, value: null },
    {
      model: "TileOccupancy",
      key: "0x1ac01",
      value: wire({ ...occupancy, col: beside.col, row: beside.row, entity_id: SPIRE_ARMY }),
    },
    raisedArmyLimit(store),
  ] as never);
  return {
    ...game,
    answer: (command, chain, now) => answerRecruit(command, chain, now) ?? game.answer(command, chain, now),
  };
};

export const empireArmiesScenario = (): LabScenario => {
  const game = reinforceScenario();
  const realm = game.store.require("Structure", { game_id: 1, entity_id: 7 });
  const slots = game.store.require("SliceRules", { game_id: 1 }).troop_limit_config.empire_armies;
  game.store.applyFacts([
    {
      model: "Structure",
      key: game.store.wireKeyOf("Structure", realm)!,
      value: wire({ ...realm, base: { ...realm.base, level: RealmLevels.Empire, troop_max_explorer_count: slots } }),
    },
  ] as never);
  return game;
};

/** ManageTroops::RecruitExplorer (troop_management.cairo's third variant). */
const RECRUIT_EXPLORER = 2n;

/** A ManageTroops RecruitExplorer, as its span reads: [command, RecruitExplorer, explorer, amount]; null otherwise. */
const readRecruit = (command: LabCommand) => {
  if (command.kind !== "ManageTroops") return null;
  const [, variant, explorerId, amount, option, site] = command.span.map(BigInt);
  if (variant !== RECRUIT_EXPLORER) return null;
  if (option !== 0n && option !== 1n) throw new Error("Missing reinforcement source");
  if (option === 0n && site === undefined) throw new Error("Missing supply post id");
  return { explorerId, amount, supplyPost: option === 0n ? Number(site) : undefined };
};

/** recruit_explorer: the army holds what is added; its realm pays the troops from its stock and their raise. */
const answerRecruit = (command: LabCommand, chain: NativeFactStore, now: number): LabFact[] | null => {
  const recruit = readRecruit(command);
  if (!recruit) return null;
  const [key, army] = [...chain.entries("ExplorerTroops")].find(([, row]) => row.explorer_id === recruit.explorerId)!;
  const realm = chain.require("Structure", { game_id: army.game_id, entity_id: army.owner });
  if (!reinforcementSource(chain, realm, Number(army.explorer_id), now, recruit.supplyPost))
    throw new Error("Army is not beside its supply source");
  const troop = getTroopResourceId(army.troops.category as TroopType, army.troops.tier as TroopTier);
  const whole = Number(recruit.amount / BigInt(RESOURCE_PRECISION));
  const raise = readTroopRaiseCost(chain, 1, Number(army.owner), troop, whole, now);
  if (!raise) throw new Error(`The lab's realm ${army.owner} holds an unknown balance its raise needs`);
  return [
    {
      model: "ExplorerTroops",
      key,
      value: wire({ ...army, troops: { ...army.troops, count: army.troops.count + recruit.amount } }),
    },
    ...balancesPaid(chain, army.owner, [{ resource: troop, amount: recruit.amount }, ...raise]),
  ];
};
