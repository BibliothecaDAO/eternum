import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { TileOccupier } from "@bibliothecadao/types";

import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { wire, type LabCommand, type LabFact, type LabScenario } from "./lab-chain";
import { standTheArmyAtTheEdge } from "./explore-scenario";
import { armySpent, besideOnOpenLand, spireScenario } from "./spire-scenario";

/** The stamina a Well gives (rules.cairo's WELL_STAMINA). */
const WELL_STAMINA = 60;
/** The XP a Shrine gives, as Frontier's progression rules set it. */
const SHRINE_XP = 200;

/**
 * The spire's army, with its progression at its start, and a Shrine and a Well beside it (/lab/game?scenario=sites), on
 * Frontier's progression rules. The
 * chain answers InteractSite as relics.cairo's interact_site applies it: the site consumed (its tile vacated), then a
 * Shrine's fixed XP to the army, or a Well's stamina.
 */
export const sitesScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  // At the edge of the seen land, away from the spire, whose card a phone opens for an army picked beside it.
  standTheArmyAtTheEdge(store);
  const army = store.entityOccupancy(1, SPIRE_ARMY)!;
  store.applyFacts([siteAt("0x1ac1", besideOnOpenLand(store, army), 901, TileOccupier.Shrine)] as never);
  store.applyFacts([
    siteAt("0x1ac2", besideOnOpenLand(store, army), 902, TileOccupier.Well),
    {
      model: "ArmyProgress",
      key: "0x1ac4",
      value: {
        game_id: 1,
        explorer_id: String(SPIRE_ARMY),
        xp: 0,
        battle: 1,
        logistics: 1,
        scouting: 1,
        scouting_kinds: 0,
        homecoming: 1,
      },
    },
    {
      model: "ArmyProgressionRules",
      key: "0x1ac3",
      value: {
        game_id: 1,
        reveal_xp: 2,
        fixed_xp: SHRINE_XP,
        uncommon_xp: 100,
        rare_xp: 200,
        epic_xp: 400,
        legendary_xp: 800,
      },
    },
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "InteractSite" ? answerSiteUse(command, chain, now) : spire.answer(command, chain, now),
  };
};

const siteAt = (key: string, tile: { col: number; row: number }, entity: number, category: TileOccupier): LabFact => ({
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
  if (site.category === TileOccupier.Shrine) return [vacated, shrineXp(chain, explorerId)];
  return [vacated, wellStamina(chain, explorerId, now)];
};

const shrineXp = (chain: NativeFactStore, explorerId: bigint): LabFact => {
  const [key, progress] = [...chain.entries("ArmyProgress")].find(([, row]) => row.explorer_id === explorerId)!;
  const fixed = chain.require("ArmyProgressionRules", { game_id: 1 }).fixed_xp;
  return { model: "ArmyProgress", key, value: wire({ ...progress, xp: progress.xp + fixed }) };
};

/** A Well's stamina, held to the army's bar as grant_stamina clamps it. */
const wellStamina = (chain: NativeFactStore, explorerId: bigint, now: number): LabFact => {
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: explorerId });
  const maximum = chain.require("SliceRules", { game_id: 1 }).troop_stamina_config.stamina_knight_max;
  const held = Number((army.troops.stamina as { Inline: { amount: bigint } }).Inline.amount);
  return armySpent(chain, explorerId, -Math.min(WELL_STAMINA, maximum - held), now);
};
