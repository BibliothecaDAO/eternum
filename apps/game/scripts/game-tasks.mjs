/**
 * The tasks a game's proof drives (`prove:play --game … --tasks <task,task>`), each as a player does it on the HUD as it
 * stands: the view it starts from at rest, the presses in order, and the end state that must show. A press is a control
 * whose words match `text` (inside `within`), a `word` clicked where it shows, a `key`, or for `tile` the map tile whose
 * tooltip names that order (`button: "right"` sends it at once); a press with a `layout` is made at that size only.
 *
 * A task that changes the game names a `reading` of what its order changes, read where the order is given just before
 * its last press and again after it, and `expect`s how it changes (`changes` says what): one more farm, not merely the
 * Build panel opening. A reading the page does not give fails the task, as does one that does not change as expected.
 * A task's clicks are its presses, so a HUD change rewrites a task's presses and the counts compare.
 */
const sheetShows = (words) =>
  `[...document.querySelectorAll("[data-kit-sheet]")].some((el) => el.innerText.includes(${JSON.stringify(words)}))`;

const PHONE_AND_DESKTOP = ["desktop", "phone"];

const oneMore = (before, after) => after === before + 1;
const STRUCTURE_ACTIONS = 'nav[aria-label="Structure actions"]';

/** How many order surfaces stand open: the workspaces and the popovers where an order is given. */
const ORDER_SURFACES = `document.querySelectorAll(${JSON.stringify(
  ["Build", "Military", "Logistics", "Production", "Market"]
    .map((name) => `[aria-label="${name}"]:not(button)`)
    .join(", "),
)}).length`;

/** Before play opens: the entrance is pressed, nothing opens and the player is told when play opens. */
const REFUSED_BEFORE_PLAY = {
  view: "map",
  reading: ORDER_SURFACES,
  changes: "no order surface to open",
  expect: (before, after) => after === before,
  done: `document.body.innerText.includes("Starts in")`,
};

export const GAME_TASKS = {
  "gate-build": {
    goal: "Before play opens: press Build on the action strip",
    layouts: PHONE_AND_DESKTOP,
    presses: [{ name: "Build", within: STRUCTURE_ACTIONS, text: "^Build$" }],
    ...REFUSED_BEFORE_PLAY,
  },
  "gate-production": {
    goal: "Before play opens: press a resource's Manage production shortcut",
    layouts: ["desktop"],
    presses: [{ name: "Manage production", text: "^Manage production$" }],
    ...REFUSED_BEFORE_PLAY,
  },
  "blitz-farm": {
    goal: "Blitz: order a farm in the selected realm",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      { name: "Build", within: STRUCTURE_ACTIONS, text: "^Build$" },
      { name: "Farm", layout: "desktop", word: "Farm" },
      { name: "Farm's Build", layout: "phone", within: '[aria-label="Build"]', text: "^Build$" },
    ],
    // The open Build panel's count for the selected realm: a phone's "Farm N built", desktop's "N total" ("Empty realm" is 0).
    reading: `(() => {
      const text = document.querySelector('[aria-label="Build"]')?.innerText ?? "";
      const count = text.match(/Farm\\s+(\\d+) built/) ?? text.match(/(\\d+) total/);
      return count ? Number(count[1]) : text.includes("Empty realm") ? 0 : null;
    })()`,
    changes: "one more building in the realm",
    expect: oneMore,
    done: `document.querySelector('[aria-label="Build"]') !== null`,
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
    reading: `(() => {
      const count = document.body.innerText.match(/Existing armies\\s+(\\d+)/);
      return count ? Number(count[1]) : null;
    })()`,
    changes: "one more army",
    expect: oneMore,
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
    // The selected army's tile, as its details name it ("Army Tile · (1, 6)"): an explore moves it onto the new tile.
    reading: `document.body.innerText.match(/Army Tile · (\\(-?\\d+, -?\\d+\\))/)?.[1] ?? null`,
    changes: "the army on another tile",
    expect: (before, after) => after !== before,
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
    reading: `[...document.querySelectorAll('[aria-label="Armies"] button')].filter((el) => (el.innerText + (el.getAttribute("aria-label") ?? "")).includes("Deploy")).length`,
    changes: "one open slot fewer",
    expect: (before, after) => after === before - 1,
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
    // The realm's Essence, as its plate names it: a reveal on the surface sends Essence home.
    reading: `(() => {
      const held = document.querySelector('[role="img"][aria-label^="Essence"]')?.getAttribute("aria-label")?.match(/[\\d,]+/);
      return held ? Number(held[0].replaceAll(",", "")) : null;
    })()`,
    changes: "more Essence",
    expect: (before, after) => after > before,
    done: `!document.body.innerText.includes("Cancel")`,
  },
};
