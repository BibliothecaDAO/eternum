import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { oathPickScenario, oathPassCappedScenario } from "./oath-pick-scenario";
import { oathSlotsScenario } from "./oath-slots-scenario";
import { battleTargetScenario, deepBattleTargetScenario } from "./battle-target-scenario";
import { townScenario } from "./town-scenario";
import { scoutsScenario } from "./scouts-scenario";
import { siteEffectsScenario } from "./site-effects-scenario";
import { baneScenario } from "./bane-scenario";
import { staminaScenario } from "./stamina-scenario";
import { questScenario } from "./quest-scenario";
import { aspectSettleInvitedScenario, aspectSettleScenario } from "./aspect-settle-scenario";
import { deepScenario } from "./deep-scenario";
import { expiredRaceScenario, raceScenario } from "./race-scenario";
import { actionsScenario } from "./actions-scenario";
import { economyScenario } from "./economy-scenario";
import { panelsScenario } from "./panels-scenario";
import { relicsScenario } from "./relics-scenario";
import { etherealDepthsScenario } from "./ethereal-depths-scenario";
import { dayEndScenario } from "./day-end-scenario";
import {
  afterBattleScenario,
  fightLostScenario,
  fightScenario,
  lowStaminaScenario,
  pointSpentScenario,
} from "./after-battle-scenario";
import { campScenario } from "./camp-scenario";
import { clearedCampScenario } from "./cleared-camp-scenario";
import { dayTurnScenario } from "./day-turn-scenario";
import { exploreScenario } from "./explore-scenario";
import { farPlaceScenario } from "./far-place-scenario";
import type { LabScenario } from "./lab-chain";
import { mergeScenario } from "./merge-scenario";
import { paintedBuildingsScenario } from "./painted-buildings-scenario";
import { realmHeightScenario } from "./realm-height-scenario";
import { realmScenario, realmWorldScenario } from "./realm-scenario";
import { supplyPostScenario } from "./supply-post-scenario";
import { reinforceScenario } from "./reinforce-scenario";
import { researchScenario } from "./research-scenario";
import { shopScenario } from "./shop-scenario";
import { ruinFarScenario, ruinFightScenario } from "./ruin-fight-scenario";
import { seasonOpensScenario } from "./season-opens-scenario";
import { settleScenario } from "./settle-scenario";
import { highGroundScenario, discoveredSpireScenario, SANDS, spireScenario } from "./spire-scenario";
import { upkeepScenario } from "./upkeep-scenario";
import { visitScenario } from "./visit-scenario";

/** The games the lab plays, by name: each a fixture and the chain's answers to the commands it proves. */
export const LAB_SCENARIOS: Partial<Record<string, () => LabScenario>> = {
  spire: spireScenario,
  "discovered-spire": discoveredSpireScenario,
  "site-effects": siteEffectsScenario,
  deep: () => deepScenario(),
  "deep-closed": () => deepScenario(true),
  "deep-battle-target": deepBattleTargetScenario,
  "oath-battle-target": () => battleTargetScenario(true),
  "oath-deep-battle-target": () => deepBattleTargetScenario(true),
  race: raceScenario,
  "race-finished": () => raceScenario(true),
  "race-expired": expiredRaceScenario,
  economy: economyScenario,
  panels: panelsScenario,
  relics: relicsScenario,
  "ethereal-depths": etherealDepthsScenario,
  /** The spire's game opened on the home page, entered by its card's Resume: a way back home there is the app's own. */
  "from-home": () => ({ ...spireScenario(), entersFromHome: true }),
  actions: actionsScenario,
  scouts: scoutsScenario,
  town: townScenario,
  "oath-slots": oathSlotsScenario,
  "oath-vitriol": () => oathPickScenario(false, deepScenario(), oaths.VITRIOL),
  "oath-pick": () => oathPickScenario(),
  "oath-replace": () => oathPickScenario(true),
  "oath-pass-capped": oathPassCappedScenario,
  "battle-target": battleTargetScenario,
  "high-ground": highGroundScenario,
  "day-end": dayEndScenario,
  realm: realmScenario,
  "realm-world": realmWorldScenario,
  "realm-height": realmHeightScenario,
  "merge-loses-training": mergeScenario("picked"),
  "merge-keeps-tapped": mergeScenario("tapped"),
  reinforce: reinforceScenario,
  "supply-post": supplyPostScenario,
  "after-battle": afterBattleScenario,
  "point-spent": pointSpentScenario,
  "low-stamina": lowStaminaScenario,
  "ruin-fight": ruinFightScenario,
  "ruin-far": ruinFarScenario,
  camp: campScenario,
  "cleared-camp": clearedCampScenario,
  fight: fightScenario,
  "fight-lost": fightLostScenario,
  research: researchScenario,
  shop: shopScenario,
  quest: questScenario,
  "bane-world": () => baneScenario("world"),
  "bane-again": () => baneScenario("again"),
  "bane-late": () => baneScenario("late"),
  "bane-team": () => baneScenario("team"),
  upkeep: upkeepScenario,
  "stamina-mist": () => staminaScenario(false),
  "stamina-wind": () => staminaScenario(true),
  settle: settleScenario,
  "aspect-settle": aspectSettleScenario,
  "aspect-settle-invited": aspectSettleInvitedScenario,
  explore: exploreScenario,
  "painted-buildings": () => paintedBuildingsScenario(),
  "painted-buildings-sands": () => paintedBuildingsScenario(SANDS),
  visit: visitScenario,
  "far-place": farPlaceScenario,
  "day-turn": dayTurnScenario("live"),
  "day-later": dayTurnScenario("later"),
  "day-turn-slow": dayTurnScenario("live", "late"),
  "day-later-short": dayTurnScenario("later", "capped"),
  "day-turn-asleep": dayTurnScenario("asleep"),
  "day-later-quiet": dayTurnScenario("later", "unplayed"),
  "day-later-skipped": dayTurnScenario("later", "skipped"),
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
