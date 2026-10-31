import { BuildingType, frontierSiteName, StructureType } from "@bibliothecadao/types";
import { FRONTIER_STORES } from "../stores";
import type { NextUpFacts } from "./next-up-facts";

/**
 * Where a Frontier Next up step's button takes the player: the realm (its board), the open army slot's Deploy, the
 * readiest army selected on the map, the sheet of an army whose XP buys a tier, today's camp, or Research.
 */
export type FrontierCoachAct = "realm" | "deploy" | "select-army" | "army" | "camp" | "research";

/**
 * A step: its line, and its button's verb and where it goes; a step taken on the map itself has neither. A step that
 * asks for a building names it, and the build sheet opens on it.
 */
export interface FrontierCoachStep {
  key: string;
  line: string;
  verb: string | null;
  act: FrontierCoachAct | null;
  build: BuildingType | null;
}

/**
 * Frontier's Next up, as Blitz's coach teaches Blitz: what the player's day calls for now, first the alerts (the day's
 * last hour, a full store, no population left), then the day's next step: barracks, an army deployed; what can be taken
 * now (a guard in reach, the army's next tier, the castle's next level, a research tier); then the day's loop,
 * exploring (and how, once the army is selected), today's camp, and rest once every army is out of stamina. It reads
 * the realm's facts (next-up-facts.ts), so a step holds while its state does and goes once it is done; nothing is
 * "seen". Each line is the action alone, never the rule behind it (owner, 26 October 2026: "good UI/UX doesnt need
 * subtext"). A step follows where the player is: in the realm, a realm step says where to press instead of offering
 * the way in.
 */
export const frontierCoachSteps = (
  facts: NextUpFacts,
  { pointer, where, tips }: { pointer: Pointer; where: Where; tips: boolean },
): FrontierCoachStep[] => {
  if (!facts.realm) return [];
  const at = { pointer, where };
  // With tips off (Settings), Next up holds the alerts alone, as Blitz's does.
  const steps = tips ? [...alerts(facts, at), ...dayLoop(facts, at)] : alerts(facts, at);
  return where === "realm" ? steps.map(withoutWayIn) : steps;
};

/** In the realm, a step's way into the realm goes nowhere: its line stands alone, with no button. */
const withoutWayIn = (step: FrontierCoachStep): FrontierCoachStep =>
  step.act === "realm" ? { ...step, verb: null, act: null } : step;

/** How the player gives a map order: a mouse right-clicks a tile, a touch screen holds it. */
type Pointer = "mouse" | "touch";
/** The view the player is in: their realm's board, or the world map. */
type Where = "realm" | "map";
type At = { pointer: Pointer; where: Where };

/**
 * A step done in the realm: from the map, its button opens the realm; in the realm, its line says where to press. The
 * building it asks for, if any, either way.
 */
const realmStep = (
  key: string,
  line: string,
  there: string,
  { where }: At,
  build: BuildingType | null = null,
): FrontierCoachStep => ({
  ...(where === "realm" ? step(key, there) : step(key, line, "Open the realm", "realm")),
  build,
});

/** The word for picking something on screen, capitalised to open a line: a mouse clicks, a touch screen taps. */
const press = (pointer: Pointer) => (pointer === "touch" ? "Tap" : "Click");

const alerts = (facts: NextUpFacts, at: At): FrontierCoachStep[] => [
  ...(facts.lastHour ? [step("last-hour", "The day ends within the hour")] : []),
  ...(facts.storeFull
    ? [
        step(
          "store-full",
          `Your ${FRONTIER_STORES[facts.storeFull].word} storage is full`,
          // Where the store is spent: labor on the realm board, wheat and troops by Deploy.
          ...(FRONTIER_STORES[facts.storeFull].made.spentAt === "realm"
            ? (["Open the realm", "realm"] as const)
            : (["Deploy", "deploy"] as const)),
        ),
      ]
    : []),
  ...(facts.populationFull
    ? [
        realmStep(
          "population-full",
          "No population left: build a Hut",
          `${press(at.pointer)} an open plot for a Hut`,
          at,
          BuildingType.WorkersHut,
        ),
      ]
    : []),
];

const dayLoop = (facts: NextUpFacts, at: At): FrontierCoachStep[] => {
  const { pointer } = at;
  const steps: FrontierCoachStep[] = [];
  if (!facts.barracks)
    steps.push(
      realmStep(
        "barracks",
        "Build barracks",
        `${press(pointer)} an open plot for Barracks`,
        at,
        BuildingType.ResourceKnightT1,
      ),
    );
  if (facts.armies === 0 && (facts.troopsAtHome ?? 0) >= 1)
    steps.push(step("deploy", "Deploy your armies", "Deploy", "deploy"));
  if (facts.guardInReach) steps.push(step("guard", `${press(pointer)} the guard beside your army`));
  if (facts.armyTierAffordable) steps.push(step("army-tier", "Your army's XP buys a tier", "Open the army", "army"));
  if (facts.castleAffordable)
    steps.push(realmStep("castle", "Your castle can grow", `${press(pointer)} your castle to grow it`, at));
  if (facts.typeTierAffordable)
    steps.push(step("research", `Research a ${facts.typeTierAffordable} tier`, "Research", "research"));
  if (facts.armies > 0 && !facts.armiesTired) steps.push(explore(facts, pointer));
  if (facts.camp)
    steps.push(
      step(
        "camp",
        `A ${frontierSiteName(StructureType.Camp)} in today's region`,
        `Show the ${frontierSiteName(StructureType.Camp)}`,
        "camp",
      ),
    );
  if (facts.armies > 0 && facts.armiesTired) steps.push(step("rest", "Your armies are out of stamina"));
  return steps;
};

/** Exploring: select the army that can; once one is selected, how to send it on the map. */
const explore = ({ armySelected }: NextUpFacts, pointer: Pointer): FrontierCoachStep =>
  armySelected
    ? step("explore-on-map", `${pointer === "touch" ? "Double-tap" : "Right-click"} a tile beside your army`)
    : step("explore", "Your army can explore", "Select the army", "select-army");

const step = (
  key: string,
  line: string,
  verb: string | null = null,
  act: FrontierCoachAct | null = null,
): FrontierCoachStep => ({ key: `frontier:${key}`, line, verb, act, build: null });
