/**
 * The tasks a game's proof drives (`prove:play --game … --tasks <task,task>`), each as a player does it on the HUD as it
 * stands: the view it starts from at rest, the presses in order, and the end state that must show. A press is a control
 * whose words match `text` (inside `within`), a `word` clicked where it shows, a `key`, a field `fill`ed with `value`,
 * for `tile` the map tile whose tooltip names that order (`button: "right"` sends it at once), or for `holdingTile`
 * another of the player's holdings on the map than the one selected; a press with a `layout` is made at that size only.
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
/** An open panel by its id: the strip's and a card's Build buttons carry the Build workspace's name, not its id. */
const panel = (id) => `[data-popover-panel="${id}"]`;
const BUILD_PANEL = panel("build");
const DEPLOY_PANEL = panel("army-deployment");

/** The troops the selected realm holds, every kind and tier, as its card's resources name them ("KnightT2 · 300 held"). */
const TROOPS_HELD = `[...document.querySelectorAll('section[aria-label="Selected holding"] ul[aria-label="Resources"] li')]
  .map((el) => el.getAttribute("aria-label")?.match(/^(?:Knight|Crossbowman|Paladin)(?:T[23])? · ([\\d,]+) held/)?.[1])
  .filter(Boolean)
  .reduce((sum, held) => sum + Number(held.replaceAll(",", "")), 0)`;

const TRANSFER_PANEL = panel("transfer");
const HOLDING_ROWS = 'aside[aria-label="Holdings"] [role=tabpanel]';
const SEND_TO_ROWS = `${TRANSFER_PANEL} section[aria-label="Send to"] [role=tabpanel]`;
const WHEAT_TOTAL = `${TRANSFER_PANEL} input[aria-label="Wheat: total to send"]`;
const SEND_ONE_WHEAT = [
  { name: "one wheat", fill: WHEAT_TOTAL, value: "1" },
  { name: "Send", within: TRANSFER_PANEL, text: "^Send " },
];

/**
 * A transfer sent: the chain took it (its toast), and the window shows it, one more delivery on the road or the
 * source's wheat down (a delivery joining one already on the road to that holding adds no row).
 */
const TRANSFER_SENT = {
  reading: `(() => {
    const surface = document.querySelector(${JSON.stringify(TRANSFER_PANEL)});
    const wheat = surface?.querySelector('input[aria-label="Wheat: total to send"]')?.closest("[role=row]");
    if (!wheat) return null;
    const arrivals = surface.querySelector('nav[aria-label="Logistics"]').innerText.match(/Arrivals \\((\\d+)\\)/);
    return { arriving: Number(arrivals?.[1] ?? 0), wheat: Number(wheat.children[1].innerText.replace(/,/g, "")) };
  })()`,
  changes: "one more delivery on the road or less wheat at the source",
  expect: (before, after) => after.arriving > before.arriving || after.wheat < before.wheat,
  done: `document.body.innerText.includes("Transfer sent.")`,
};

/** How many order surfaces stand open: the workspaces and the popovers where an order is given. */
const ORDER_SURFACES = `document.querySelectorAll(${JSON.stringify(
  ["build", "military", "logistics", "production", "market", "army-deployment", "quick-attack", "spire-travel"]
    .map(panel)
    .join(", "),
)}).length`;

/**
 * The leaderboard's window fits what it shows: its body leaves no empty room under the rows (it scrolls only when they
 * outgrow the screen), and the table's header row spans the body, leaving no empty strip beside it.
 */
const LEADERBOARD_FITS = `(() => {
  const frame = document.querySelector('[data-popover-panel="leaderboard"] [data-surface-frame]');
  const body = frame?.children[1];
  const header = body?.querySelector(".sticky");
  if (!body || !header) return false;
  const content = body.firstElementChild.getBoundingClientRect();
  const room = body.getBoundingClientRect();
  return content.height >= room.height - 2 && room.right - header.getBoundingClientRect().right <= 16;
})()`;

/** Before play opens: the entrance is pressed, nothing opens and the player is told when play opens. */
const REFUSED_BEFORE_PLAY = {
  view: "map",
  reading: ORDER_SURFACES,
  changes: "no order surface to open",
  expect: (before, after) => after === before,
  done: `document.body.innerText.includes("Starts in")`,
};

export const GAME_TASKS = {
  // The boot smoke: a signed-in player enters, the HUD and its lazy chat load, and the page raises no error (every
  // step fails on one). A rollout runs it against the deployed build.
  boot: {
    goal: "Enter the game signed in and open Chat: the HUD and its lazy parts load without an error",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    // The desktop's Chat strip, or a phone's Chat tab.
    presses: [{ name: "Chat", text: "^Chat( strip)?$" }],
    done: `document.querySelector('section[aria-label="Chat"]') !== null`,
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
      { name: "Max", text: "^Max$" },
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
  "blitz-deploy": {
    goal: "Blitz: deploy a field army from a free tile beside a structure, all its troops of one kind",
    layouts: ["desktop"],
    view: "map",
    presses: [
      // The structure selected on the map: its free neighbours then offer Create Army.
      { name: "the next structure", key: "Shift+Tab" },
      { name: "a free tile beside it, right-clicked", tile: "Create Army", button: "right" },
      { name: "Max", within: DEPLOY_PANEL, text: "^Max$" },
      { name: "Deploy", within: DEPLOY_PANEL, text: "^Deploy" },
    ],
    reading: TROOPS_HELD,
    changes: "fewer troops held in the realm",
    expect: (before, after) => after < before,
    done: `!document.querySelector(${JSON.stringify(DEPLOY_PANEL)})`,
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
  "blitz-transfer-window": {
    goal: "Blitz: send a realm's wheat to another holding from the Transfer button",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "Transfer", within: STRUCTURE_ACTIONS, text: "^Transfer$" },
      { name: "the first holding to send to", within: SEND_TO_ROWS, text: "." },
      ...SEND_ONE_WHEAT,
    ],
    ...TRANSFER_SENT,
  },
  "blitz-transfer-gesture": {
    goal: "Blitz: select a holding, right-click another of yours, and send it wheat",
    layouts: ["desktop"],
    view: "map",
    presses: [
      // The row's own button: the star beside it is named by its pin words.
      { name: "the first holding", within: HOLDING_ROWS, text: "^(?!Pin |Unpin ).+" },
      { name: "another of your holdings, right-clicked", holdingTile: true, button: "right" },
      ...SEND_ONE_WHEAT,
    ],
    ...TRANSFER_SENT,
  },
  "blitz-standings": {
    goal: "Blitz: see the standings, in a window as large as its table and rows",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [{ name: "your name chip", text: "^Identity$" }],
    done: LEADERBOARD_FITS,
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
