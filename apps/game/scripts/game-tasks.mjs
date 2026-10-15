/**
 * The tasks a game's proof drives (`prove:play --game … --tasks <task,task>`), each as a player does it on the HUD as it
 * stands: the view it starts from at rest, the presses in order, and the end state that must show. A press is a control
 * whose words match `text` (inside `within`), a `word` clicked where it shows, a `key`, or for `tile` the map tile whose
 * tooltip names that order (`button: "right"` sends it at once); a press with a `layout` is made at that size only. A
 * task that
 * changes the game names a `reading` taken before its first press; it is done only once that reading has changed, as
 * well as `done` holding. A task's clicks are its presses, so a HUD change rewrites a task's presses and the counts
 * compare.
 */
const sheetShows = (words) =>
  `[...document.querySelectorAll("[data-kit-sheet]")].some((el) => el.innerText.includes(${JSON.stringify(words)}))`;

const PHONE_AND_DESKTOP = ["desktop", "phone"];

/** The population each realm row shows ("1/6"), so a building's order reads as one more. */
const POPULATION = `(document.body.innerText.match(/\\d+\\/\\d+/g) ?? []).join(",")`;
const STRUCTURE_ACTIONS = 'nav[aria-label="Structure actions"]';

export const GAME_TASKS = {
  "blitz-farm": {
    goal: "Blitz: order a farm in the selected realm",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      { name: "Build", within: STRUCTURE_ACTIONS, text: "^Build$" },
      { name: "Farm", layout: "desktop", word: "Farm" },
      { name: "Farm's Build", layout: "phone", within: '[aria-label="Build"]', text: "^Build$" },
    ],
    reading: `(document.body.innerText.match(/\\d+\\/\\d+|\\d+ built/g) ?? []).join(",")`,
    done: `/Built here/.test(document.body.innerText)`,
  },
  "blitz-army": {
    goal: "Blitz: create a field army from the selected realm",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "Military", within: STRUCTURE_ACTIONS, text: "^Military$" },
      { name: "MAX", text: "^MAX$" },
      { name: "Create field army", text: "^Create field army$" },
    ],
    reading: `document.body.innerText.match(/Existing armies\\s+(\\d+)/)?.[1] ?? null`,
    done: `document.body.innerText.includes("Existing armies")`,
  },
  "blitz-explore": {
    goal: "Blitz: send an army to explore",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "the next army", key: "Tab" },
      { name: "an unexplored tile, right-clicked", tile: "Explore", button: "right" },
    ],
    reading: `document.body.innerText.includes("Scouts sent")`,
    done: "true",
  },
  "blitz-standings": {
    goal: "Blitz: see the standings",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [{ name: "your name chip", text: "^Identity$" }],
    done: `/Leaderboard|Standings/.test(document.body.innerText)`,
  },
  production: {
    goal: "Read the realm's production: each store's rate an hour against its limit",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [{ name: "the stores", within: "header", text: "^[\\d,.]+[KM]?( [\\d,.]+[KM]?){3}$" }],
    done: sheetShows("Production"),
  },
  standings: {
    goal: "See the season's standings",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      { name: "Menu", text: "^Menu$" },
      { name: "Season", within: "[data-kit-sheet]", text: "^Season" },
    ],
    done: `document.querySelector('[aria-label="Season"]') !== null`,
  },
  research: {
    goal: "Open Research, where the depths (Ethereal I to III) are unlocked",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [{ name: "Research", text: "^Research$" }],
    done: `document.querySelector('section[aria-label="Research"]') !== null`,
  },
  deploy: {
    goal: "Resume the day: deploy an army from the realm",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "an open slot", within: '[aria-label="Armies"]', text: "Deploy" },
      { name: "Deploy with its wheat", within: "[data-kit-sheet]", text: "^Deploy [\\d,.]+" },
    ],
    reading: `[...document.querySelectorAll('[aria-label="Armies"] button')].filter((el) => el.innerText.includes("Deploy")).length`,
    done: `!document.querySelector("[data-kit-sheet]")`,
  },
  explore: {
    goal: "Explore a tile with an army",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "the army", within: '[aria-label="Armies"]', text: "^Army" },
      { name: "an unexplored tile", tile: "Explore" },
      { name: "Explore", text: "^Explore$" },
    ],
    reading: `document.querySelector("header button")?.innerText`,
    done: `!document.body.innerText.includes("Cancel")`,
  },
};
