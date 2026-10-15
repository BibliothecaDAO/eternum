import sharp from "sharp";

import {
  blocked,
  completed,
  describeOrders,
  failed,
  judgeExplore,
  judgeNextOrder,
  refusalErrors,
} from "./evidence.mjs";
import { openOrderSendGate, VIEWPORT } from "./browser-session.mjs";

/**
 * The playtest's steps. Each plays through the controls a player uses, then checks what a player would see, and is
 * judged completed, blocked (the game refused, for a reason a player meets too) or failed. Only completed steps are
 * evidence for what they name.
 */

const SCENE_WAIT_MS = 15_000;
const SCENE_HOLD_MS = 3_000;
const PLACE_PRESSES = 2;
const PLAYABLE_WAIT_MS = 30_000;
const POLL_MS = 500;
const ARMY_FLIGHT_MS = 1_500;
const ZOOM_SETTLE_MS = 2_500;
const TAP_PASSES = 2;
const ORDER_SEND_WAIT_MS = 10_000;
// A refusal comes back with the node's answer; the client has logged it well within this.
const REFUSAL_LOG_MS = 3_000;
// A pan moves the whole map under the camera; the same view, animated, changes far less (map-idle records that floor).
const PAN_VIEW_CHANGE_MIN = 6;
// The army's six neighbours on screen, in pixels from the centre, at the map's default zoom (a player run never zooms),
// in ring order from the north-east: each is beside the next, and the last beside the first.
const NEIGHBOUR_RING = [
  [65, -95],
  [137, 0],
  [70, 100],
  [-75, 100],
  [-135, 0],
  [-67, -95],
];

/** The game these steps read (Frontier's place bar, army dock and order bar), and its card on the home page. */
export const STEPS_GAME = { mode: "frontier", homeCard: "Frontier" };

/** What a spectator does: look at the realm, open the map, move the camera, read the menu, switch scenes, watch. */
export const SPECTATOR_STEPS = [
  { name: "realm-idle", settleMs: 8_000, verify: inScene("hex") },
  { name: "open-map", play: goTo("Map", "map"), settleMs: 6_000, verify: inScene("map") },
  { name: "map-idle", play: keepTheViewBefore, settleMs: 10_000, verify: idledOnTheMap },
  { name: "pan", play: panTheMap, settleMs: 17_000, verify: pannedTheMap },
  { name: "zoom", play: zoomOutAndIn, settleMs: 1_000, verify: zoomedOutAndIn },
  { name: "menu", play: readTheSeasonInTheMenu, settleMs: 1_000, verify: sheetOpenedAndClosed("Menu") },
  { name: "open-realm", play: goTo("Realm", "hex"), settleMs: 8_000, verify: inScene("hex") },
  { name: "return-to-map", play: goTo("Map", "map"), settleMs: 8_000, verify: inScene("map") },
  { name: "steady", settleMs: 60_000, verify: inScene("map") },
];

/**
 * What a signed-in player does: realm, map, select the readiest army, read production, then a tile tapped for the army
 * while its order is in flight (its next order) in each way that order can leave, and two explores.
 */
export const PLAYER_STEPS = [
  { name: "realm-idle", settleMs: 8_000, verify: inScene("hex") },
  { name: "open-map", play: goTo("Map", "map"), settleMs: 6_000, verify: inScene("map") },
  { name: "select-army", play: selectTheReadiestArmy, settleMs: 3_000, verify: armySelected },
  { name: "production", play: openAndCloseProduction, settleMs: 1_000, verify: sheetOpenedAndClosed("Production") },
  ...nextOrderSteps(),
  { name: "explore-1", play: exploreBesideArmy, settleMs: 6_000, verify: explored },
  { name: "explore-2", play: exploreBesideArmy, settleMs: 6_000, verify: explored },
  // Last: it leaves the map for the realm.
  nextOrderStep("next-order-deselect", queueThenOpenTheRealm, {
    next: ["queued", "dropped:not-selected"],
    confirmed: 1,
  }),
];

/**
 * Presses a place's control until its scene holds on a playable page. A first trip to the map may reload the page
 * (perf-1, conviction 2), and the reloaded page shows the map before its boot moves on to the realm; so arrival counts
 * only once the scene is still there SCENE_HOLD_MS later, and the control is pressed again otherwise, as a player would.
 */
function goTo(place, scene) {
  return async ({ browser }) => {
    const startedOn = browser.observe().timeOrigin;
    for (let presses = 1; presses <= PLACE_PRESSES; presses += 1) {
      browser.click(place);
      if (await arrives(browser, place, scene)) {
        return { presses, reloaded: browser.observe().timeOrigin !== startedOn };
      }
      await waitFor(browser, (seen) => seen.playable, PLAYABLE_WAIT_MS);
    }
    return { presses: PLACE_PRESSES, reloaded: browser.observe().timeOrigin !== startedOn };
  };
}

async function arrives(browser, place, scene) {
  const shown = (seen) => seen.playable && isIn(seen, place, scene);
  if (!(await waitFor(browser, shown, SCENE_WAIT_MS))) return false;
  await sleep(SCENE_HOLD_MS);
  return shown(browser.observe());
}

function inScene(scene) {
  const place = scene === "map" ? "Map" : "Realm";
  return ({ seen }) =>
    isIn(seen, place, scene)
      ? completed({ scene })
      : failed(
          `expected the ${scene} scene drawn with ${place} lit, saw the route on ${seen.scene ?? "no scene"}, ` +
            `${seen.rendered ?? "no scene"} drawn, ${seen.place ?? "nothing"} lit`,
        );
}

/** The route, the scene drawn and the lit place agree: a route on the map over a realm still drawn is not the map. */
const isIn = (seen, place, scene) =>
  seen.scene === scene && seen.rendered === scene && Boolean(seen.place?.startsWith(place));

/** WASD round trip of 16 s; the view before and after are kept to prove the camera moved over the map. */
async function panTheMap({ browser, extraScreenshot }) {
  const before = extraScreenshot("before");
  browser.run(["eval", `void window.__playtest.pan(["KeyD","KeyS","KeyA","KeyD","KeyS","KeyD","KeyS","KeyD"], 2000)`]);
  return { before };
}

async function pannedTheMap({ seen, played, screenshot }) {
  const viewChange = await meanViewChange(played.before, screenshot);
  const scene = inScene("map")({ seen });
  if (scene.status !== "completed") return { ...scene, viewChange };
  return viewChange >= PAN_VIEW_CHANGE_MIN
    ? completed({ viewChange })
    : failed(`the view barely changed (${viewChange} < ${PAN_VIEW_CHANGE_MIN}): the camera did not move`, {
        viewChange,
      });
}

/** The same view with nothing pressed: how much the map's own animation changes it, the floor a pan must clear. */
async function keepTheViewBefore({ extraScreenshot }) {
  return { before: extraScreenshot("before") };
}

async function idledOnTheMap({ seen, played, screenshot }) {
  const viewChange = await meanViewChange(played.before, screenshot);
  return { ...inScene("map")({ seen }), viewChange };
}

/** Mean absolute difference of two screenshots (or of one region of them), greyscale at 96×54, in 0–255 levels. */
async function meanViewChange(beforePath, afterPath, region = null) {
  const pixels = (path) =>
    (region ? sharp(path).extract(region) : sharp(path)).resize(96, 54, { fit: "fill" }).greyscale().raw().toBuffer();
  const [before, after] = await Promise.all([pixels(beforePath), pixels(afterPath)]);
  let total = 0;
  for (let index = 0; index < before.length; index += 1) total += Math.abs(before[index] - after[index]);
  return Math.round((total / before.length) * 10) / 10;
}

async function zoomOutAndIn({ browser }) {
  const distance = () => browser.observe().worldmapDistance;
  // The map keeps a camera distance only once the player zooms; a notch in gives a fresh profile one to start from.
  if (distance() === null) {
    browser.run(["eval", "void window.__playtest.wheel(-100, 1)"]);
    await sleep(ZOOM_SETTLE_MS);
  }
  const before = distance();
  browser.run(["eval", "void window.__playtest.wheel(100, 8)"]);
  await sleep(ZOOM_SETTLE_MS);
  const zoomedOut = distance();
  browser.run(["eval", "void window.__playtest.wheel(-100, 8)"]);
  await sleep(ZOOM_SETTLE_MS);
  return { before, zoomedOut, zoomedIn: distance() };
}

function zoomedOutAndIn({ seen, played }) {
  const scene = inScene("map")({ seen });
  if (scene.status !== "completed") return scene;
  const { before, zoomedOut, zoomedIn } = played;
  const isDistance = (value) => typeof value === "number";
  return isDistance(before) &&
    isDistance(zoomedOut) &&
    isDistance(zoomedIn) &&
    zoomedOut > before &&
    zoomedIn < zoomedOut
    ? completed(played)
    : failed(`the camera distance did not grow from where it was, then shrink (${JSON.stringify(played)})`, played);
}

async function readTheSeasonInTheMenu({ browser }) {
  browser.click("Menu");
  await sleep(1_500);
  const opened = browser.observe().dialogs;
  browser.click("Season");
  await sleep(2_000);
  const read = browser.observe().dialogs;
  browser.press("Escape");
  await sleep(1_000);
  return { opened, read, closed: browser.observe().dialogs };
}

/** The store bar opens production; its name starts with the first store it shows. */
async function openAndCloseProduction({ browser }) {
  browser.run(["find", "role", "button", "click", "--name", "Essence"]);
  await sleep(1_500);
  const opened = browser.observe().dialogs;
  browser.press("Escape");
  await sleep(1_000);
  return { opened, closed: browser.observe().dialogs };
}

function sheetOpenedAndClosed(label) {
  return ({ played }) => {
    if (!played.opened.includes(label))
      return failed(`no ${label} sheet opened (open: ${played.opened.join(", ") || "none"})`);
    if (played.closed.includes(label)) return failed(`the ${label} sheet did not close`);
    return completed(played);
  };
}

/** The army with the most stamina, as a player picks the one that can act; selecting it centres the camera on it. */
async function selectTheReadiestArmy({ browser }) {
  const armies = browser.armies();
  return { armies, army: await focusTheReadiestArmy(browser, armies) };
}

/** An order clears the selection, so every order starts by selecting (and centring) the army that can act. */
async function focusTheReadiestArmy(browser, armies = browser.armies()) {
  const readiest = armies.toSorted((left, right) => (right.stamina || 0) - (left.stamina || 0))[0];
  if (!readiest) return null;
  await pickArmy(browser, readiest.label);
  return readiest.label;
}

async function pickArmy(browser, army) {
  browser.click(army);
  await sleep(ARMY_FLIGHT_MS);
}

function armySelected({ seen, played }) {
  if (!played.army) return blocked("the player has no army on the HUD");
  return seen.pressed.includes(played.army)
    ? completed({ army: played.army, armies: played.armies })
    : failed(`${played.army} is not selected (pressed: ${seen.pressed.join(", ") || "none"})`);
}

/** Centres the army, taps its neighbours until one offers Explore, and confirms it; other offers are cancelled. */
async function exploreBesideArmy({ browser, extraScreenshot }) {
  const army = await focusTheReadiestArmy(browser);
  if (!army) return { offered: [], army };
  const offered = [];
  // The army's paths are planned once it is selected; a pass where no tile pins anything is tried once more.
  for (let pass = 1; pass <= TAP_PASSES; pass += 1) {
    for (const offset of NEIGHBOUR_RING) {
      browser.tap(offset);
      const verb = orderVerb(browser.buttonTexts());
      offered.push(verb);
      if (verb === "Explore") {
        const before = extraScreenshot("before");
        const pressedAt = browser.observe().now;
        browser.press("Enter");
        return { army, offered, pressedAt, before, target: offset };
      }
    }
    if (offered.some(Boolean)) break;
    await sleep(ARMY_FLIGHT_MS);
  }
  browser.press("Escape");
  return { army, offered };
}

/** The client's record of the explore, and the screen around the explored tile before Enter against after settling. */
async function explored({ played, actionLatency, screenshot }) {
  const tileChange = played.before ? await meanViewChange(played.before, screenshot, tileRegion(played.target)) : null;
  return judgeExplore({ ...played, tileChange }, actionLatency.clientActions);
}

/** A 120×100 patch centred on a tile tapped at `offset` from the screen centre. */
function tileRegion([dx, dy]) {
  return { left: VIEWPORT.width / 2 + dx - 60, top: VIEWPORT.height / 2 + dy - 50, width: 120, height: 100 };
}

/**
 * A next order's life, one way of leaving per step, ahead of the explores so the army's stamina goes to them first.
 * Each holds the army's first order in flight at the network for as long as it acts; refused answers that send as the
 * node refusing it, without it reaching the node; the others let it go.
 */
function nextOrderSteps() {
  return [
    nextOrderStep("next-order-run", queueTheTileAfter, { next: ["queued", "run"], confirmed: 2 }),
    nextOrderStep(
      "next-order-replaced",
      queueThenReplace,
      { next: ["queued", "dropped:replaced", "queued", "run"], confirmed: 2 },
      { needsOther: true },
    ),
    nextOrderStep("next-order-cancel", queueThenCancel, { next: ["queued", "dropped:cancelled"], confirmed: 1 }),
    nextOrderStep("next-order-escape", queueThenEscape, { next: ["queued", "dropped:cancelled"], confirmed: 1 }),
    nextOrderStep(
      "next-order-refused",
      queueTheTileAfter,
      { next: ["queued", "dropped:refused"], confirmed: 0 },
      { refuse: true },
    ),
  ];
}

function nextOrderStep(name, whileInFlight, expected, { refuse = false, needsOther = false } = {}) {
  return {
    name,
    play: withOrderInFlight(whileInFlight, { refuse, needsOther }),
    settleMs: 8_000,
    verify: ({ played, actionLatency, window }) =>
      judgeNextOrder({
        expected,
        played,
        orders: describeOrders({ armyTrace: actionLatency.armyMovement, ...window }),
      }),
  };
}

/**
 * Centres the army, finds tiles beside it that offer an order, taps and confirms the first (the first order) and, once
 * its send is held at the network, acts with the others: the tile after the first stays beside the army when it stands
 * on the first, so an order queued for it can run. The held send then goes, or fails.
 */
function withOrderInFlight(whileInFlight, { refuse, needsOther }) {
  return async ({ browser, devTools, extraScreenshot }) => {
    const army = await focusTheReadiestArmy(browser);
    if (!army) return { army };
    const { scanned, targets } = await findOrderTiles(browser, army, needsOther);
    if (!targets) return { army, scanned };
    const gate = await openOrderSendGate(devTools);
    try {
      browser.tap(targets.first);
      browser.press("Enter");
      const firstSent = await waitUntil(() => gate.held() > 0, ORDER_SEND_WAIT_MS);
      if (!firstSent) return { army, scanned, targets, firstSent };
      const played = await whileInFlight({ browser, targets, extraScreenshot });
      if (!refuse) {
        await gate.release();
        return { army, scanned, targets, firstSent, ...played };
      }
      const provokedErrors = refusalErrors(await linesLoggedDuring(browser, () => gate.refuse()));
      return { army, scanned, targets, firstSent, ...played, provokedErrors };
    } finally {
      await gate.close();
    }
  };
}

/**
 * Tiles that offer the army an order: two beside each other, and another one for a step that needs it. Its paths are
 * planned once it is selected, slower than a tap at 4x: a pass that finds none is tried once more.
 */
async function findOrderTiles(browser, army, needsOther) {
  let scanned = [];
  for (let pass = 1; pass <= TAP_PASSES; pass += 1) {
    scanned = await scanTheRing(browser, army);
    const targets = orderTiles(scanned);
    if (targets && (!needsOther || targets.other)) return { scanned, targets };
    await sleep(ARMY_FLIGHT_MS);
  }
  return { scanned, targets: null };
}

/** The console lines the client logs while `provoke` plays out. */
async function linesLoggedDuring(browser, provoke) {
  const logged = () => browser.run(["console"], { allowFailure: true }).split("\n");
  const before = logged().length;
  await provoke();
  await sleep(REFUSAL_LOG_MS);
  return logged()
    .slice(before)
    .map((line) => line.trim());
}

/**
 * What each tile of the ring offers the army, the pin cleared after. A tile holding the player's own realm or another
 * of their armies selects that instead: it offers this army nothing, and the army is picked again.
 */
async function scanTheRing(browser, army) {
  const scanned = [];
  for (const offset of NEIGHBOUR_RING) {
    browser.tap(offset);
    const stillPicked = browser.observe().pressed.includes(army);
    scanned.push({ offset, verb: stillPicked ? orderVerb(browser.buttonTexts()) : null });
    if (!stillPicked) await pickArmy(browser, army);
  }
  browser.press("Escape");
  return scanned;
}

/**
 * The first tile and the one after it on the ring, both offering an order, the most Moves first (a move costs less
 * stamina), and another ring tile that offers one, if any.
 */
function orderTiles(scanned) {
  const pairs = scanned
    .map((tile, index) => [tile, scanned[(index + 1) % scanned.length]])
    .filter((pair) => pair.every(offersOrder));
  const moves = (tiles) => tiles.filter(({ verb }) => verb === "Move").length;
  const [first, after] = pairs.toSorted((left, right) => moves(right) - moves(left))[0] ?? [];
  if (!first) return null;
  const other = scanned.find((tile) => offersOrder(tile) && tile !== first && tile !== after);
  return { first: first.offset, after: after.offset, other: other?.offset ?? null };
}

const offersOrder = ({ verb }) => verb === "Explore" || verb === "Move";

async function queueTheTileAfter({ browser, targets, extraScreenshot }) {
  browser.tap(targets.after);
  return { queuedShown: nextOrderShown(browser), queuedScreenshot: extraScreenshot("queued") };
}

async function queueThenReplace({ browser, targets, extraScreenshot }) {
  browser.tap(targets.other);
  const queuedShown = nextOrderShown(browser);
  browser.tap(targets.after);
  return { queuedShown, replacedShown: nextOrderShown(browser), queuedScreenshot: extraScreenshot("queued") };
}

async function queueThenCancel({ browser, targets, extraScreenshot }) {
  const queued = await queueTheTileAfter({ browser, targets, extraScreenshot });
  browser.run(["find", "role", "button", "click", "--name", "Cancel"]);
  return { ...queued, shownAfterCancel: nextOrderShown(browser) };
}

async function queueThenEscape({ browser, targets, extraScreenshot }) {
  const queued = await queueTheTileAfter({ browser, targets, extraScreenshot });
  browser.press("Escape");
  return { ...queued, shownAfterEscape: nextOrderShown(browser) };
}

async function queueThenOpenTheRealm({ browser, targets, extraScreenshot }) {
  const queued = await queueTheTileAfter({ browser, targets, extraScreenshot });
  browser.click("Realm");
  await sleep(ARMY_FLIGHT_MS);
  return queued;
}

/** The order bar's next order, as a screen reader names its chip: "Next order Queued". */
const nextOrderShown = (browser) => browser.read(`Boolean(document.querySelector('[aria-label="Next order Queued"]'))`);

/** What the order bar offers after a tap: its verb, "short" when it shows a cost not covered (the verb is hidden), or null. */
function orderVerb(buttonTexts) {
  const verb = buttonTexts.map((text) => /^(Explore|Move)/.exec(text)?.[1]).find(Boolean);
  if (verb) return verb;
  return buttonTexts.some((text) => text.startsWith("Cancel")) ? "short" : null;
}

async function waitUntil(check, timeoutMs) {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > timeoutMs) return false;
    await sleep(POLL_MS);
  }
  return true;
}

async function waitFor(browser, predicate, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate(browser.observe())) return true;
    await sleep(POLL_MS);
  }
  return false;
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
