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
 * "seen". The numbers come from the game's rules, never typed into a line; a line whose number is unknown says it
 * without one.
 */
export const frontierCoachSteps = (
  facts: NextUpFacts,
  { pointer, tips }: { pointer: Pointer; tips: boolean },
): FrontierCoachStep[] => {
  if (!facts.realm) return [];
  // With tips off (Settings), Next up holds the alerts alone, as Blitz's does.
  return tips ? [...alerts(facts), ...dayLoop(facts, pointer)] : alerts(facts);
};

/** How the player gives a map order: a mouse right-clicks a tile, a touch screen holds it. */
type Pointer = "mouse" | "touch";

const alerts = (facts: NextUpFacts): FrontierCoachStep[] => [
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
        step(
          "population-full",
          `No population left: every building takes some. A Hut adds ${facts.rules?.hutAdds ?? "more"}.`,
          "Open the realm",
          "realm",
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

const dayLoop = (facts: NextUpFacts, pointer: Pointer): FrontierCoachStep[] => {
  const steps: FrontierCoachStep[] = [];
  if (!facts.barracks)
    steps.push(
      step("barracks", "Build barracks: only barracks train troops for your armies.", "Open the realm", "realm"),
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
      step(
        "guard",
        `A guard stands beside your army: ${pointer === "touch" ? "tap" : "click"} it to see the fight before you choose.`,
      ),
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
      step("castle", "Enough labor: your castle can grow, with more plots and army slots.", "Open the realm", "realm"),
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
        "A camp in today's region: count their troops, then yours. Clearing it teaches your army.",
        "Show the camp",
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
