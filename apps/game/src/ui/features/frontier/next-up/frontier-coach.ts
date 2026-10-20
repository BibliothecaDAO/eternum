import { frontierSiteName, StructureType } from "@bibliothecadao/types";
import type { NextUpFacts } from "./next-up-facts";

/**
 * Where a Frontier Next up step's button takes the player: the realm (its board), the open army slot's Deploy, the
 * readiest army selected on the map, the sheet of an army whose XP buys a tier, today's camp, Research, or Production.
 */
export type FrontierCoachAct = "realm" | "deploy" | "select-army" | "army" | "camp" | "research" | "production";

/** A step: its line, and its button's verb and where it goes; a step taken on the map itself has neither. */
export interface FrontierCoachStep {
  key: string;
  line: string;
  verb: string | null;
  act: FrontierCoachAct | null;
}

/**
 * Frontier's Next up, as Blitz's coach teaches Blitz: what the player's day calls for now, first the alerts (the day's
 * last hour, a full store, no population left), then the day's next step: barracks, an army deployed; what can be taken
 * now (a guard in reach, the army's next tier, the castle's next level, a research tier); then the day's loop,
 * exploring (and how, once the army is selected), today's camp, and rest once every army is out of stamina. It reads
 * the realm's facts (next-up-facts.ts), so a step holds while its state does and goes once it is done; nothing is
 * "seen". A step follows where the player is: in the realm, a realm step says what to do there instead of offering
 * the way in. The numbers come from the game's rules, never typed into a line; a line whose number is unknown says
 * it without one.
 */
export const frontierCoachSteps = (
  facts: NextUpFacts,
  { pointer, where, tips }: { pointer: Pointer; where: Where; tips: boolean },
): FrontierCoachStep[] => {
  if (!facts.realm) return [];
  const at = { pointer, where };
  // With tips off (Settings), Next up holds the alerts alone, as Blitz's does.
  return tips ? [...alerts(facts, at), ...dayLoop(facts, at)] : alerts(facts, at);
};

/** How the player gives a map order: a mouse right-clicks a tile, a touch screen holds it. */
type Pointer = "mouse" | "touch";
/** The view the player is in: their realm's board, or the world map. */
type Where = "realm" | "map";
type At = { pointer: Pointer; where: Where };

/** A step done in the realm: from the map, its button opens the realm; in the realm, its line says what to do there. */
const realmStep = (key: string, line: string, there: string, { where }: At): FrontierCoachStep =>
  where === "realm" ? step(key, there) : step(key, line, "Open the realm", "realm");

/** The word for picking something on screen: a mouse clicks, a touch screen taps. */
const press = (pointer: Pointer) => (pointer === "touch" ? "tap" : "click");

const alerts = (facts: NextUpFacts, at: At): FrontierCoachStep[] => [
  ...(facts.lastHour ? [lastHour(facts)] : []),
  ...(facts.storeFull
    ? [
        step(
          "store-full",
          `Your ${facts.storeFull} store is full: what does not fit is gone. Spend it, or store more.`,
          "Production",
          "production",
        ),
      ]
    : []),
  ...(facts.populationFull
    ? [
        realmStep(
          "population-full",
          `No population left: every building takes some. A Hut adds ${facts.rules?.hutAdds ?? "more"}.`,
          `No population left: every building takes some. A Hut adds ${facts.rules?.hutAdds ?? "more"}: ${press(at.pointer)} an open plot to build one.`,
          at,
        ),
      ]
    : []),
];

const lastHour = ({ rules }: NextUpFacts): FrontierCoachStep =>
  step(
    "last-hour",
    rules
      ? `The day ends within the hour, and armies still out end with it. Homecoming sends ${rules.homecomingPercent}% of their troops home.`
      : "The day ends within the hour, and armies still out end with it.",
  );

const dayLoop = (facts: NextUpFacts, at: At): FrontierCoachStep[] => {
  const { pointer } = at;
  const steps: FrontierCoachStep[] = [];
  if (!facts.barracks)
    steps.push(
      realmStep(
        "barracks",
        "Build barracks: only barracks train troops for your armies.",
        `Build barracks: ${press(at.pointer)} an open plot, then Barracks. Only barracks train troops for your armies.`,
        at,
      ),
    );
  if (facts.armies === 0 && (facts.troopsAtHome ?? 0) >= 1)
    steps.push(
      step(
        "deploy",
        "Deploy your armies: one strong army, two scouts. They stay out until the day ends.",
        "Deploy",
        "deploy",
      ),
    );
  if (facts.guardInReach)
    steps.push(
      step("guard", `A guard stands beside your army: ${press(pointer)} it to see the fight before you choose.`),
    );
  if (facts.armyTierAffordable)
    steps.push(
      step(
        "army-tier",
        "Your army's XP buys a tier: Battle for the main army, Scouting for scouts.",
        "Open the army",
        "army",
      ),
    );
  if (facts.castleAffordable)
    steps.push(
      realmStep(
        "castle",
        "Enough labor: your castle can grow, with more plots and army slots.",
        `Enough labor: ${press(at.pointer)} your castle to grow it, with more plots and army slots.`,
        at,
      ),
    );
  if (facts.typeTierAffordable)
    steps.push(
      step(
        "research",
        `Research a ${facts.typeTierAffordable} tier: store more, or make more, for every ${facts.typeTierAffordable}.`,
        "Research",
        "research",
      ),
    );
  if (facts.armies > 0 && !facts.armiesTired) steps.push(explore(facts, pointer));
  if (facts.camp)
    steps.push(
      step(
        "camp",
        `A ${frontierSiteName(StructureType.Camp)} in today's region: compare its strength with your army. Defeating it teaches your army.`,
        `Show the ${frontierSiteName(StructureType.Camp)}`,
        "camp",
      ),
    );
  if (facts.armies > 0 && facts.armiesTired) steps.push(rest(facts));
  return steps;
};

/** Exploring: select the army that can; once one is selected, how to send it on the map, and what a tile pays. */
const explore = ({ armySelected, rules }: NextUpFacts, pointer: Pointer): FrontierCoachStep => {
  const pays = rules?.xp
    ? `each new tile sends Essence or labor home and gives ${rules.xp.reveal} XP`
    : "each new tile sends Essence or labor home and gives XP";
  if (!armySelected) return step("explore", `Your army can explore: ${pays}.`, "Select the army", "select-army");
  const cost = rules ? ` (${rules.stamina.explore} stamina)` : "";
  const send = pointer === "touch" ? "Hold a tile beside your army" : "Click a tile beside your army";
  return step("explore-on-map", `${send} to explore it${cost}: ${pays}.`);
};

const rest = ({ rules }: NextUpFacts): FrontierCoachStep =>
  step(
    "rest",
    rules
      ? `Your armies are out of stamina: ${rules.stamina.anHour} come back each hour, while you are away too.`
      : "Your armies are out of stamina: it comes back by the hour, while you are away too.",
  );

const step = (
  key: string,
  line: string,
  verb: string | null = null,
  act: FrontierCoachAct | null = null,
): FrontierCoachStep => ({ key: `frontier:${key}`, line, verb, act });
