import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { TileOccupier } from "@bibliothecadao/types";

import { frontierPreset } from "../../../../../config/source/frontier/native";
import type { LabScenario } from "./lab-chain";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";

const wire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? String(field) : field)));

/**
 * The army's stamina and XP as it reaches the sites: a Well's 60 fits under its bar, and a Shrine's XP takes it past
 * the price of its first tier.
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
  const xp = frontierPreset.progression;
  store.applyFacts([
    {
      model: "ArmyProgressionRules",
      key: "0x1af10",
      value: {
        game_id: 1,
        reveal_xp: xp.revealXp,
        fixed_xp: xp.fixedXp,
        uncommon_xp: xp.uncommonXp,
        rare_xp: xp.rareXp,
        epic_xp: xp.epicXp,
        legendary_xp: xp.legendaryXp,
      },
    },
    {
      model: "ExplorerTroops",
      key: "0x74",
      value: wire({
        ...army,
        troops: { ...army.troops, stamina: { Inline: { amount: STAMINA, settled_at: spire.startsAt, remainder: 0 } } },
      }),
    },
    {
      model: "ArmyProgress",
      key: "1:201",
      value: {
        game_id: 1,
        explorer_id: String(SPIRE_ARMY),
        xp: XP,
        battle: 1,
        logistics: 1,
        scouting: 1,
        scouting_kinds: 0,
        homecoming: 1,
      },
    },
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
  return spire;
};
