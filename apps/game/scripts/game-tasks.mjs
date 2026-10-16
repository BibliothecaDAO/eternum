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
const STRUCTURE_ACTIONS = 'nav[aria-label="Realm actions"]';
/** An open panel by its id: the strip's and a card's Build buttons carry the Build workspace's name, not its id. */
const panel = (id) => `[data-popover-panel="${id}"]`;
const BUILD_PANEL = panel("build");

/** How many order surfaces stand open: the workspaces and the popovers where an order is given. */
const ORDER_SURFACES = `document.querySelectorAll(${JSON.stringify(
  ["build", "military", "logistics", "production", "market", "army-deployment", "quick-attack", "spire-travel"]
    .map(panel)
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

const holdingsOnPhone = { name: "Holdings", layout: "phone", text: "^Holdings$" };
const chosenHolding = {
  name: "the matching holding",
  selector: ".holding-row",
  check: `document.querySelector('.holding-row[aria-pressed="true"] .holding-name')?.textContent === document.querySelector('[aria-label="Find a structure"]').value && document.querySelector(".realm-panel")?.innerText.includes(document.querySelector('[aria-label="Find a structure"]').value)`,
};
const localFarm = {
  name: "the farm beside the keep",
  point: { desktop: [850, 440], phone: [315, 412] },
  check: `document.querySelector(".tile-panel")?.innerText.includes("Realm tile")`,
};
const inspectTile = { name: "tile details", selector: ".tile-panel summary" };
const noSheet = '!document.querySelector("[data-popover-panel]")';

export const GAME_TASKS = {
  // The boot smoke: a signed-in player enters, the HUD and its lazy chat load, and the page raises no error (every
  // step fails on one). A rollout runs it against the deployed build.
  boot: {
    goal: "Enter the game signed in and open Chat: the HUD and its lazy parts load without an error",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [{ name: "Chat", text: "^Chat$" }],
    done: `document.querySelector('section[aria-label="Chat"]') !== null`,
  },
  "hud-holdings": {
    goal: "Search, filter and select a holding through the connected HUD",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      holdingsOnPhone,
      {
        name: "All structures",
        text: "^All structures$",
        check: `document.querySelectorAll(".holding-row").length > 0`,
      },
      {
        name: "find another holding",
        fill: '[aria-label="Find a structure"]',
        valueFrom: `document.querySelectorAll(".holding-name")[1].textContent`,
        check: `document.querySelectorAll(".holding-row").length === 1`,
      },
      {
        name: "Realms",
        within: ".category-chips",
        text: "^Realms$",
        check: `document.querySelector('.category-chips [aria-label="Realms"]').getAttribute("aria-pressed") === "true"`,
      },
      chosenHolding,
      {
        name: "clear search",
        fill: '[aria-label="Find a structure"]',
        value: "",
        check: `document.querySelectorAll(".holding-row").length > 1`,
      },
      {
        name: "return to the first holding",
        selector: ".holding-row",
        check: `document.querySelector(".realm-panel")?.innerText.includes(document.querySelector(".holding-name").textContent)`,
      },
    ],
    done: `document.querySelector('[aria-label="Production automation"]') !== null`,
  },
  "hud-level-up": {
    goal: "Complete the first holding's available level-up",
    layouts: ["desktop"],
    view: "map",
    presses: [
      {
        name: "the first realm's available level-up",
        selector: '.holding-row:first-child button[aria-label^="Level up"]:not([disabled])',
      },
    ],
    reading: `Number(document.querySelector(".holding-row .holding-level")?.textContent.replace(/[^0-9]/g, ""))`,
    changes: "one realm level gained",
    expect: (before, after) => after === before + 1,
    done: `document.querySelector(".holding-row") !== null`,
  },
  "hud-upgrade": {
    goal: "Inspect an unavailable level-up and its requirements without sending it",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      holdingsOnPhone,
      {
        name: "upgrade requirements",
        selector:
          '.holding-row:has(button[disabled][aria-label^="Level up"]) button[aria-label="View upgrade requirements"]',
        check: `document.body.innerText.includes("Upgrade")`,
      },
    ],
    done: `document.querySelector('.holding-row button[disabled][aria-label^="Level up"]') !== null && document.body.innerText.includes("Upgrade")`,
  },
  "hud-local": {
    goal: "Inspect a local farm after direct realm entry, then switch scenes",
    layouts: PHONE_AND_DESKTOP,
    view: "realm",
    presses: [
      localFarm,
      { ...inspectTile, check: `document.querySelector(".tile-panel")?.innerText.includes("Farm ·")` },
      {
        name: "read the building actions",
        layout: "phone",
        scroll: '.tile-panel button[aria-label="Stop"]',
        check: `(() => { const b = document.querySelector('.tile-panel button[aria-label="Stop"]'); const r = b.getBoundingClientRect(); return !b.disabled && b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); })()`,
      },
      {
        name: "World map",
        within: "header",
        text: "^World map$",
        check: `!document.querySelector(".tile-panel")?.innerText.includes("Farm ·")`,
      },
      { name: "Realm", within: "header", text: "^Realm$", check: `location.pathname.endsWith("/hex")` },
    ],
    done: `location.pathname.endsWith("/hex")`,
  },
  "hud-automation": {
    goal: "Change the selected realm to Idle, then restore Smart automation",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      holdingsOnPhone,
      {
        name: "Idle automation",
        select: '[aria-label="Production automation"]',
        value: "idle",
        check: `document.querySelector('[aria-label="Production automation"]')?.value === "idle"`,
      },
      { name: "Smart automation", select: '[aria-label="Production automation"]', value: "smart" },
    ],
    reading: `document.querySelector('[aria-label="Production automation"]')?.value`,
    changes: "automation from Idle to Smart",
    expect: (before, after) => before === "idle" && after === "smart",
    done: `document.querySelector('[aria-label="Production automation"]')?.value === "smart"`,
  },
  "hud-commands": {
    goal: "Open every permitted Blitz command surface from its floating bubble",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      ...[
        ["Build", "build"],
        ["Production", "production"],
        ["Military", "military"],
        ["Transfer", "logistics"],
      ].flatMap(([name, id]) => [
        {
          name,
          within: STRUCTURE_ACTIONS,
          text: `^${name}$`,
          check: `document.querySelector('[data-popover-panel="${id}"]') !== null`,
        },
        { name: `close ${name}`, within: `[data-popover-panel="${id}"]`, text: "^Close$", check: noSheet },
      ]),
    ],
    done: noSheet,
  },
  "hud-minimap": {
    goal: "Open a crowded minimap sector and drag to navigate the map",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      {
        name: "a populated sector",
        selector: ".minimap [data-sector]:not([disabled])",
        check: `document.querySelector('.minimap-field[data-grouped="false"]') !== null`,
      },
      { name: "drag the minimap", drag: ".minimap svg", delta: [40, 20] },
    ],
    reading: `document.querySelector(".minimap svg")?.getAttribute("viewBox")`,
    changes: "the minimap view after dragging",
    expect: (before, after) => before !== after,
    done: `document.querySelector('.minimap-field[data-grouped="false"]') !== null`,
  },
  "gate-build": {
    goal: "Before play opens: press Build on the action strip",
    layouts: PHONE_AND_DESKTOP,
    presses: [{ name: "Build", within: STRUCTURE_ACTIONS, text: "^Build$" }],
    ...REFUSED_BEFORE_PLAY,
  },
  "gate-production": {
    goal: "Before play opens: double-click the realm's keep, which opens its production",
    layouts: ["desktop"],
    presses: [{ name: "the realm's keep, double-clicked", dblclick: "canvas" }],
    ...REFUSED_BEFORE_PLAY,
    view: "realm",
  },
  "blitz-farm": {
    goal: "Blitz: order a farm in the selected realm",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      { name: "Build", within: STRUCTURE_ACTIONS, text: "^Build$" },
      { name: "Farm", layout: "desktop", word: "Farm" },
      { name: "Farm's Build", layout: "phone", within: BUILD_PANEL, text: "^Build$" },
    ],
    // The open Build panel's count for the selected realm: a phone's "Farm N built", desktop's "N total" ("Empty realm" is 0).
    reading: `(() => {
      const text = document.querySelector(${JSON.stringify(BUILD_PANEL)})?.innerText ?? "";
      const count = text.match(/Farm\\s+(\\d+) built/) ?? text.match(/(\\d+) total/);
      return count ? Number(count[1]) : text.includes("Empty realm") ? 0 : null;
    })()`,
    changes: "one more building in the realm",
    expect: oneMore,
    done: `document.querySelector(${JSON.stringify(BUILD_PANEL)}) !== null`,
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
  "blitz-transfer": {
    goal: "Blitz: open Transfer Troops & Relics from an army beside its realm",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      { name: "the next army", key: "Tab" },
      // The transfer order's tooltip; "Transfer" alone is also the action strip's button.
      { name: "its realm's tile, right-clicked", tile: "Troops / Resources", button: "right" },
    ],
    // A full modal stands in the middle of the screen, wherever on the map it was opened from, and wholly on it.
    done: `(() => {
      const panel = document.querySelector(${JSON.stringify(panel("help"))});
      if (!panel) return false;
      const box = panel.getBoundingClientRect();
      const centredAcross = Math.abs(box.left + box.width / 2 - innerWidth / 2) <= 2;
      return centredAcross && box.top >= 0 && box.left >= 0 && box.bottom <= innerHeight && box.right <= innerWidth;
    })()`,
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
