/**
 * The tasks a game's proof drives (`prove:play --game … --tasks <task,task>`), each as a player does it on the HUD as it
 * stands: the view it starts from at rest, the presses in order, and the end state that must show. A press is a control
 * whose words match `text` (inside `within`), a `word` clicked where it shows, a `key`, a field `fill`ed with `value`,
 * for `tile` the map tile whose tooltip matches that pattern (`button: "right"` sends it at once), or for `holdingTile`
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

/**
 * The troops the selected realm holds, every kind and tier, as its card's resources name them ("Knight T2 · 300 held").
 * Null, not 0, when the card names none of its resources: a card that lost its names says nothing about troops.
 */
const TROOPS_HELD = `(() => {
  const names = [...document.querySelectorAll('section[aria-label="Selected holding"] ul[aria-label="Resources"] li')]
    .map((el) => el.getAttribute("aria-label"))
    .filter(Boolean);
  if (names.length === 0) return null;
  return names
    .map((name) => name.match(/^(?:Knight|Crossbowman|Paladin) T[123] · ([\\d,]+) held/)?.[1])
    .filter(Boolean)
    .reduce((sum, held) => sum + Number(held.replaceAll(",", "")), 0);
})()`;

const TRANSFER_PANEL = panel("transfer");
const HOLDING_ROWS = 'aside[aria-label="Holdings"] [role=tabpanel]';
const SEND_TO_UNPICKED = `${TRANSFER_PANEL} section[aria-label="Send to"] [role=tabpanel] button[aria-selected="false"]`;
const WHEAT_TOTAL = `${TRANSFER_PANEL} input[aria-label="Wheat: total to send"]`;
const sendWheat = (total) => [
  { name: `${total} wheat`, fill: WHEAT_TOTAL, value: String(total) },
  { name: "Send", within: TRANSFER_PANEL, text: "^Send " },
];

/** Wheat's resource id, as the game numbers it. */
const WHEAT = 35;

/**
 * A transfer sent: the window has let its destinations go, and the game's facts show every chosen holding's wheat
 * (held, and on the road to it) up by at least its share of the total. Read from the facts, not the window, so a
 * shipment that landed nowhere or got no answer fails the task, and a delivery merging into one already on the road
 * still counts. Each holding row carries its id as its button's value.
 */
const TRANSFER_SENT = {
  reading: `(() => {
    const surface = document.querySelector(${JSON.stringify(TRANSFER_PANEL)});
    const total = surface?.querySelector('input[aria-label="Wheat: total to send"]');
    const stock = window.__eternumHoldingGoods?.(${WHEAT});
    if (!total || !stock) return null;
    const rows = surface.querySelectorAll('section[aria-label="Send to"] button[aria-selected="true"]');
    return { total: Number(total.value), chosen: [...rows].map((row) => Number(row.value)), stock };
  })()`,
  changes: "every chosen holding's wheat up by its share",
  expect: (before, after) => everyShareArrived(before, after),
  done: `document.querySelector(${JSON.stringify(TRANSFER_PANEL)})?.innerText.includes("Choose where to send") === true`,
};

/** Whether each holding chosen before Send holds at least its even share more wheat after it. */
const everyShareArrived = (before, after) => {
  if (!Array.isArray(before?.chosen) || before.chosen.length === 0 || !(before.total > 0) || !after?.stock)
    return false;
  const share = Math.floor(before.total / before.chosen.length);
  return before.chosen.every((id) => (after.stock[id] ?? 0) - (before.stock[id] ?? 0) >= share);
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
  const body = document.querySelector('[data-popover-panel="leaderboard"] .ui-window__body');
  const header = body?.querySelector(".ui-table-head");
  if (!body || !header) return false;
  const content = body.firstElementChild.getBoundingClientRect();
  const room = body.getBoundingClientRect();
  return content.height >= room.height - 2 && room.right - header.getBoundingClientRect().right <= 16;
})()`;

/**
 * The leaderboard's column headers in two rows: each title on one line and each rule under it on one line, none cut
 * off by its column.
 */
const LEADERBOARD_HEADERS_FIT = `[...document.querySelectorAll('[data-popover-panel="leaderboard"] .ui-table-head > div')]
  .filter((cell) => cell.offsetParent !== null)
  .every((cell) => cell.children.length <= 2 && cell.scrollWidth <= cell.clientWidth + 1 &&
    [...cell.children].every((line) => line.getBoundingClientRect().height <= parseFloat(getComputedStyle(line).lineHeight) + 1))`;

/**
 * A player's detail open beside the leaderboard: the window stays as tall as what it shows (no scroll for a short
 * detail), and the table keeps its width, running up to the detail with no strip between them.
 */
const LEADERBOARD_DETAIL_FITS = `(() => {
  const body = document.querySelector('[data-popover-panel="leaderboard"] .ui-window__body');
  const header = body?.querySelector(".ui-table-head");
  const detail = body?.querySelector('[aria-label="Player details"]');
  if (!body || !header || !detail) return false;
  const content = body.firstElementChild.getBoundingClientRect();
  const room = body.getBoundingClientRect();
  const gap = detail.getBoundingClientRect().left - header.getBoundingClientRect().right;
  return content.height >= room.height - 2 && body.scrollHeight <= body.clientHeight + 2 && gap >= 0 && gap <= 24;
})()`;

/** Before play opens: the entrance is pressed, nothing opens and the player is told when play opens. */
// Each reason the planner gives a tile no order, as the map's line words it (order-tip.ts).
const ORDER_REFUSAL = [
  "Needs \\d+ stamina",
  "Not enough food for the army",
  "Only unclaimed structures can be attacked",
  "This game allows no transfer here",
  "No army can enter this tile",
  "Too far: move next to it",
].join("|");

const REFUSED_BEFORE_PLAY = {
  view: "map",
  reading: ORDER_SURFACES,
  changes: "no order surface to open",
  expect: (before, after) => after === before,
  done: `document.body.innerText.includes("Starts in")`,
};

/** The map's tooltip on a tile the selected army can attack: the order, then its stamina. */
const ATTACK_TILE = "(^|\\n)Attack\\n[\\d,]+ stamina";

/**
 * Inside `within` (a row of actions, or a card's body), the button whose words match `verb` ends at the right edge and
 * every other button on its line starts at the left edge: one rule for every row of actions, the verb alone at the
 * right, the way out and the rest at the left.
 */
const verbAloneAtRight = (within, verb) => `(() => {
  const scope = document.querySelector(${JSON.stringify(within)});
  const buttons = [...(scope?.querySelectorAll("button") ?? [])];
  const verb = buttons.find((el) => new RegExp(${JSON.stringify(verb)}).test(el.innerText.trim()));
  if (!verb) return false;
  const style = getComputedStyle(scope);
  const box = scope.getBoundingClientRect();
  const left = box.left + parseFloat(style.paddingLeft);
  const right = box.right - parseFloat(style.paddingRight);
  const at = verb.getBoundingClientRect();
  const others = buttons
    .filter((el) => el !== verb)
    .map((el) => el.getBoundingClientRect())
    .filter((other) => Math.abs(other.top + other.height / 2 - (at.top + at.height / 2)) < at.height / 2);
  return Math.abs(right - at.right) <= 1 && others.every((other) => other.right < at.left) &&
    (others.length === 0 || Math.abs(Math.min(...others.map((other) => other.left)) - left) <= 1);
})()`;

/**
 * What the chat-place task reads where its last press is given and after it: the message this run sent (the one with
 * its token) and the place it carries (its key, whether it is this game's and opens), the map's selection (structure,
 * army, hex), where the camera looks and on which layer, and whether chat covers the map (a phone's page).
 */
const chatPlaceReading = (token) => `(() => {
  const map = window.__eternumMapSelection ?? {};
  const pane = document.querySelector('section[aria-label="Chat"]');
  const sent = [...(pane?.querySelectorAll("li[data-message-id]") ?? [])].findLast((row) =>
    row.innerText.includes(${JSON.stringify(token)}),
  );
  const chip = sent?.querySelector("[data-place-key]");
  return {
    phone: innerWidth < 1024,
    chatShown: Boolean(pane && pane.getBoundingClientRect().height > 0),
    sent: chip
      ? {
          key: chip.getAttribute("data-place-key"),
          here: !chip.hasAttribute("data-elsewhere"),
          opens: !(chip.querySelector("button")?.disabled ?? true),
        }
      : null,
    structure: map.structure ?? null,
    army: map.army ?? null,
    hex: map.hex ?? null,
    camera: map.camera ?? null,
    layer: map.layer ?? null,
  };
})()`;

const isHex = (hex) => Number.isInteger(hex?.col) && Number.isInteger(hex?.row);
const sameHex = (a, b) => isHex(a) && isHex(b) && a.col === b.col && a.row === b.row;
const nearHex = (a, b) => isHex(a) && isHex(b) && Math.abs(a.col - b.col) <= 1 && Math.abs(a.row - b.row) <= 1;

/** A place key (placeKey in the client): its game, then what it is. */
const parsePlaceKey = (key) => {
  const target = /^[^/]+\/(structure|army):(\d+)$/.exec(key ?? "");
  if (target) return { kind: target[1], entityId: Number(target[2]) };
  const site = /^[^/]+\/site:[^@]+@(\d+),(\d+),(surface|depth)$/.exec(key ?? "");
  return site
    ? { kind: "site", tile: { col: Number(site[1]), row: Number(site[2]) }, depth: site[3] === "depth" }
    : null;
};

/**
 * The chat-place task's outcome, as the player sees the map: the message this run sent came back carrying a place of
 * this game that opens; where the camera stood before the press and after it were both read; the camera stood off the
 * place (more than a hex away) when it was pressed; and after it the map has that very place selected (the structure or
 * army by its id, a site by its exact tile and its layer) and is centred on its tile, with the map in view again on a
 * phone (its chat page put away).
 */
export const chatPlaceOpened = (before, after) => {
  if (!before?.sent?.here || !before.sent.opens || !after) return false;
  const place = parsePlaceKey(before.sent.key);
  if (!place || !isHex(before.camera) || !isHex(after.camera)) return false;
  // The tile the place stands on, as the map gives it once that very place is selected; none for anything else.
  const tile =
    place.kind === "structure"
      ? after.structure?.id === place.entityId
        ? after.hex
        : null
      : place.kind === "army"
        ? after.army?.id === place.entityId
          ? after.army.hex
          : null
        : sameHex(after.hex, place.tile) && after.layer === place.depth
          ? place.tile
          : null;
  if (!isHex(tile)) return false;
  const mapInView = !after.phone || !after.chatShown;
  return !nearHex(before.camera, tile) && sameHex(after.camera, tile) && mapInView;
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
  // Sharing a place in chat, as a player does it: the realm selected on the map, Chat opened (on a phone its tab puts
  // the realm's card away), the place button, words this run alone writes, Send. Then the map is moved off the realm
  // (on a phone, Chat put away to reach it and opened again), and the place in the message this run sent is pressed.
  "chat-place": {
    goal: "Share the selected realm in Global, move the map away, and open the realm from the message sent",
    layouts: PHONE_AND_DESKTOP,
    view: "map",
    presses: [
      { name: "the next structure", key: "Shift+Tab" },
      { name: "Chat", text: "^Chat( strip)?$" },
      { name: "the place button", within: 'section[aria-label="Chat"]', text: "^Share the selected place$" },
      {
        name: "words",
        fill: 'section[aria-label="Chat"] input[aria-label="Message"]',
        value: (token) => `hold here ${token}`,
      },
      { name: "Send", within: 'section[aria-label="Chat"] form', text: "^Send$" },
      { name: "Chat, put away", layout: "phone", within: 'nav[aria-label="Places"]', text: "^Chat" },
      { name: "the map, dragged away", drag: [-260, -180] },
      { name: "Chat, again", layout: "phone", within: 'nav[aria-label="Places"]', text: "^Chat" },
      {
        name: "the place in the message sent",
        within: 'section[aria-label="Chat"] li[data-message-id]',
        having: (token) => token,
        inside: "[data-place-key]",
        text: ".",
      },
    ],
    reading: chatPlaceReading,
    changes: "the map opens on the very place sent, selected, the camera on it",
    expect: chatPlaceOpened,
    done: `window.__eternumMapSelection?.camera !== undefined`,
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
  "blitz-build-window": {
    goal: "Blitz: open Build and read what each building costs and makes, at 1920x1080",
    layouts: ["wide"],
    view: "map",
    presses: [{ name: "Build", text: "^Build$" }],
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
    goal: "Blitz: deploy a field army of 500 (or all, if fewer) from a free tile beside a structure, with +500",
    layouts: ["desktop"],
    view: "map",
    presses: [
      // The structure selected on the map: its free neighbours then offer Create Army.
      { name: "the next structure", key: "Shift+Tab" },
      { name: "a free tile beside it, right-clicked", tile: "Create Army", button: "right" },
      { name: "+500", within: DEPLOY_PANEL, text: "^\\+500$" },
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
      // The tile's order line; "Transfer" alone is also the action strip's button.
      { name: "its realm's tile, right-clicked", tile: "Transfer troops", button: "right" },
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
    goal: "Blitz: send a realm's wheat to two other holdings at once from the Transfer button",
    // The window stacks its stages in a phone's sheet, upright and sideways; Send is scrolled to there.
    layouts: ["desktop", "phone", "landscape"],
    view: "map",
    presses: [
      { name: "Transfer", within: STRUCTURE_ACTIONS, text: "^Transfer$" },
      // Two destinations: the wheat total splits evenly between them, a shipment each.
      { name: "a holding to send to", within: SEND_TO_UNPICKED, text: "." },
      { name: "a second holding to send to", within: SEND_TO_UNPICKED, text: "." },
      ...sendWheat(2),
    ],
    ...TRANSFER_SENT,
  },
  "blitz-transfer-tabs": {
    goal: "Blitz: open the Transfer window, see its views as tabs and its three columns as panels, and come back",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "Transfer", within: STRUCTURE_ACTIONS, text: "^Transfer$" },
      {
        name: "the Balances tab",
        within: `${TRANSFER_PANEL} [aria-label="Transfer views"]`,
        text: "^(Balances|BALANCES)$",
      },
      {
        name: "the Transfer tab",
        within: `${TRANSFER_PANEL} [aria-label="Transfer views"]`,
        text: "^(Transfer|TRANSFER)$",
      },
    ],
    // Back on Transfer: Send from and Send to each lead with their kind tabs.
    done: `document.querySelectorAll(${JSON.stringify(`${TRANSFER_PANEL} [role="tablist"][aria-label$="by kind"]`)}).length === 2`,
  },
  "blitz-transfer-balances": {
    goal: "Blitz: send wheat to two holdings from the Transfer window's Balances tab",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "Transfer", within: STRUCTURE_ACTIONS, text: "^Transfer$" },
      { name: "Balances", within: `${TRANSFER_PANEL} [aria-label="Transfer views"]`, text: "^(Balances|BALANCES)$" },
      { name: "the wheat's Transfer in Balances", text: "^Transfer Wheat$" },
      { name: "a holding to send to", within: SEND_TO_UNPICKED, text: "." },
      { name: "a second holding to send to", within: SEND_TO_UNPICKED, text: "." },
      ...sendWheat(2),
    ],
    ...TRANSFER_SENT,
  },
  "blitz-transfer-gesture": {
    goal: "Blitz: choose a holding in the holdings list, right-click another of yours on the map, and send it wheat",
    layouts: ["desktop"],
    view: "map",
    presses: [
      // The row's own button: the star beside it is named by its pin words.
      { name: "the first holding", within: HOLDING_ROWS, text: "^(?!Pin |Unpin ).+" },
      { name: "another of your holdings, right-clicked", holdingTile: true, button: "right" },
      ...sendWheat(1),
    ],
    ...TRANSFER_SENT,
  },
  "blitz-transfer-gesture-map": {
    goal: "Blitz: select a holding on the map, right-click another of yours, and send it wheat",
    layouts: ["desktop"],
    view: "map",
    presses: [
      // Selecting a holding on the map draws its deploy tiles: the right-click on another must still be the transfer.
      { name: "another of your holdings, selected on the map", holdingTile: true },
      { name: "another of your holdings, right-clicked", holdingTile: true, button: "right" },
      ...sendWheat(1),
    ],
    ...TRANSFER_SENT,
  },
  "blitz-order-hint": {
    goal: "Blitz: with an army selected, a tile says what a right-click does there, its cost and its payoff",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "the next army", key: "Tab" },
      { name: "a tile it has an order on, hovered", hover: "Right-click · (Explore|Move)" },
    ],
    done: `/Right-click · (Explore|Move) · \\d+ stamina/.test(document.body.innerText)`,
  },
  "blitz-order-refusal": {
    goal: "Blitz: with an army selected, a tile with no order says why",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "the next army", key: "Tab" },
      { name: "a tile it cannot order, hovered", hover: ORDER_REFUSAL },
    ],
    done: `/${ORDER_REFUSAL}/.test(document.body.innerText)`,
  },
  "blitz-attack-forecast": {
    goal: "Blitz: an army's attack forecast, Details at the left and the verb alone at the right, nothing sent",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "the next army", key: "Tab" },
      { name: "a tile it can attack, right-clicked", tile: ATTACK_TILE, button: "right" },
    ],
    done: verbAloneAtRight(`${panel("quick-attack")} .ui-actions`, "^(Attack|Claim)$"),
  },
  "blitz-standings": {
    goal: "Blitz: see the standings, in a window as large as its table and rows, each column header in two rows",
    layouts: [...PHONE_AND_DESKTOP, "wide"],
    view: "map",
    presses: [{ name: "your name chip", text: "^Identity$" }],
    done: `${LEADERBOARD_FITS} && ${LEADERBOARD_HEADERS_FIT}`,
  },
  "blitz-standings-detail": {
    goal: "Blitz: open the first player's detail beside the standings, at 1920x1080",
    layouts: ["wide"],
    view: "map",
    presses: [
      { name: "your name chip", text: "^Identity$" },
      { name: "the first player's row", within: '[data-popover-panel="leaderboard"] [data-player-address]', text: "." },
    ],
    done: LEADERBOARD_DETAIL_FITS,
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
    goal: "Open Research for depth unlocks and the Scouts' lodge's Scouting choices",
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
  "attack-forecast": {
    goal: "An army's attack forecast on its target's card, Attack alone at the right, nothing sent",
    layouts: ["desktop"],
    view: "map",
    presses: [
      { name: "the army", within: '[aria-label="Armies"]', text: "^Army" },
      { name: "a tile it can attack, right-clicked", tile: ATTACK_TILE, button: "right" },
    ],
    done: verbAloneAtRight("[data-kit-sheet] .ui-frame__body", "^Attack$"),
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
