import {
  BUILD_ORDER_GOALS,
  BUILD_ORDER_LIMITS,
  buildOrderGoalName,
  buildOrderJson,
  buildOrderTarget,
  type BuildOrder,
  type BuildOrderGoal,
} from "./build-order";

/** What two buildings do that their names do not say. */
const BUILDING_NOTES: Partial<Record<BuildOrderGoal, string>> = {
  farm: "wheat feeds every building and army",
  hut: "population room; one is added by itself when the next step needs room, so list huts only to build them ahead",
};

/** A goal as the prompt explains it, from the goal list itself, so the prompt can never fall behind it. */
const goalLine = (goal: BuildOrderGoal): string => {
  const target = buildOrderTarget(goal);
  const note = BUILDING_NOTES[goal];
  if (target.kind === "building") return `${goal}: ${buildOrderGoalName(goal)}${note ? `; ${note}` : ""}`;
  if (target.kind === "barracks") return `${goal}: the ${target.tier} barracks of the troop the realm's biome favours`;
  if (target.kind === "army")
    return `${goal}: field armies of that troop at ${target.tier}, each deployed once a full army is on hand`;
  return `${goal}: the realm's next rank, taken at this point of the order instead of as soon as it can be paid`;
};

/**
 * What a player copies to ask an AI for help with an order: the game in two lines, the order's JSON and its rules, and
 * their current order, answered with JSON only so it pastes straight back.
 */
export const buildOrderPrompt = (order: BuildOrder): string =>
  [
    "Help me write a build order for Blitz, a short match in Realms, an onchain strategy game. Blitz is won on points: exploring tiles, opening crates, and holding camps, rifts and Hyperstructures. My realm grows through four ranks: Settlement, City, Kingdom, Empire. Level-ups past City cost resources, Essence among them, which armies find by exploring.",
    "A build order is the list of steps my realm follows. The game shows the next step only once the realm can take it, so a step has no time. Production and troop training are run by the realm's automation, not by the order.",
    'The order is JSON: {"name": "…", "steps": [{"rank": "Settlement", "goal": "farm", "count": 2}, {"rank": "City", "goal": "levelUp"}]}.',
    "Goals:",
    ...BUILD_ORDER_GOALS.map((goal) => `- ${goalLine(goal)}`),
    "Rules:",
    "- rank is the rank a step starts at; steps go rank by rank, never back.",
    "- count is how many to have in total, not how many to add: 4 farm after 2 farm builds two more.",
    "- The realm levels up first whenever it can, unless the order has a levelUp at that rank; then the level up waits its turn. A rank has one levelUp at most, Empire none. levelUp has no count.",
    `- At most ${BUILD_ORDER_LIMITS.steps} steps, counts from 1 to ${BUILD_ORDER_LIMITS.count}, a name of ${BUILD_ORDER_LIMITS.name} characters at most.`,
    "My current order:",
    buildOrderJson(order),
    "Answer with the improved order's JSON only, so I can paste it into the game.",
  ].join("\n");
