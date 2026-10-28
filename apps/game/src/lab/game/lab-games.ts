import { dayEndScenario } from "./day-end-scenario";
import { afterBattleScenario, lowStaminaScenario } from "./after-battle-scenario";
import { exploreScenario } from "./explore-scenario";
import { mergeScenario } from "./merge-scenario";
import { dayTurnScenario } from "./day-turn-scenario";
import type { LabScenario } from "./lab-chain";
import { paintedBuildingsScenario } from "./painted-buildings-scenario";
import { realmScenario } from "./realm-scenario";
import { seasonOpensScenario } from "./season-opens-scenario";
import { sitesScenario } from "./sites-scenario";
import { highGroundScenario, spireScenario } from "./spire-scenario";

/** The games the lab plays, by name: each a fixture and the chain's answers to the commands it proves. */
export const LAB_SCENARIOS: Partial<Record<string, () => LabScenario>> = {
  spire: spireScenario,
  "high-ground": highGroundScenario,
  "day-end": dayEndScenario,
  realm: realmScenario,
  "merge-keeps-picked": mergeScenario("picked"),
  "merge-keeps-tapped": mergeScenario("tapped"),
  "after-battle": afterBattleScenario,
  "low-stamina": lowStaminaScenario,
  explore: exploreScenario,
  "painted-buildings": paintedBuildingsScenario,
  sites: sitesScenario,
  "day-turn": dayTurnScenario("live"),
  "day-later": dayTurnScenario("later"),
  "day-turn-slow": dayTurnScenario("live", "late"),
  "day-later-short": dayTurnScenario("later", "capped"),
  "day-turn-asleep": dayTurnScenario("asleep"),
  "day-later-quiet": dayTurnScenario("later", "unplayed"),
  "day-later-played-on": dayTurnScenario("later", "played-on"),
  "season-opens": seasonOpensScenario,
};

/** The lab game this tab plays: its scenario and the wall time its chain's clock started at. */
interface KeptLabGame {
  name: string;
  startedAt: number;
}

const KEPT_GAME = "lab.game";

/** Starts a lab game for this tab, its chain's clock from now. */
export const startLabGame = (name: string): KeptLabGame => {
  const game = { name, startedAt: Date.now() };
  try {
    window.sessionStorage.setItem(KEPT_GAME, JSON.stringify(game));
  } catch {
    // Storage refused: a reload of the game cannot find it again, and says so.
  }
  return game;
};

/** The lab game this tab started, for a reload of its route; null when it started none. */
export const keptLabGame = (): KeptLabGame | null => {
  try {
    const kept = window.sessionStorage.getItem(KEPT_GAME);
    return kept ? (JSON.parse(kept) as KeptLabGame) : null;
  } catch {
    return null;
  }
};
