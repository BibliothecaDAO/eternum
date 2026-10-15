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
import { measureFrameChanges, recordFrames } from "./frames.mjs";

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
// An order's outcome, from its send to the army offered orders again.
const ORDER_OUTCOME_WAIT_MS = 30_000;
const HOVER_SETTLE_MS = 400;
// Escape steps back one thing at a time: a pinned order, an open view, then the selection.
const ESCAPES_TO_DESELECT = 3;
// A refusal comes back with the node's answer; the client has logged it well within this.
const REFUSAL_LOG_MS = 3_000;
// A pan moves the whole map under the camera; the same view, animated, changes far less (map-idle records that floor).
const PAN_VIEW_CHANGE_MIN = 6;
// The closest view, where structures cast their shadows too: more notches in than the map has.
const ZOOM_IN_NOTCHES = 15;
// The map's closest camera distance: WORLDMAP_CAMERA_ZOOM.minDistance (worldmap-camera-view-profile.ts), held equal by
// a test. A distance within the tolerance has arrived there.
export const CLOSEST_CAMERA_DISTANCE = 10;
const CLOSEST_DISTANCE_TOLERANCE = 0.05;
// A still map's frames: long enough to span several of the sun's shadow steps, few enough to keep as evidence.
const STILL_FRAMES_MS = 6_000;
const STILL_FRAMES_MIN = 30;
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

/**
 * The games the step lists are written for: the directory's mode, and the card on the home page a player enters it by,
 * with its call to action. Frontier's card has its title; a Blitz card is found by the game it names, and only a player
 * seated in it can Enter.
 */
const FRONTIER = { mode: "frontier", card: { heading: "Frontier", enter: "^(Resume|Play)" } };
const BLITZ = { mode: "blitz", card: { heading: null, enter: "^Enter$" } };

/** What a spectator does: look at the realm, open the map, move the camera, read the menu, switch scenes, watch. */
export const SPECTATOR_STEPS = [
  { name: "realm-idle", settleMs: 8_000, verify: inScene("hex") },
  { name: "open-map", play: goTo("Map", "map"), settleMs: 6_000, verify: inScene("map") },
  { name: "map-idle", play: keepTheViewBefore, settleMs: 10_000, verify: idledOn(inScene("map")) },
  { name: "pan", play: panTheMap, settleMs: 17_000, verify: panned(inScene("map")) },
  { name: "zoom", play: zoomOutAndIn, settleMs: 1_000, verify: zoomedOutAndIn(inScene("map")) },
  { name: "menu", play: readTheSeasonInTheMenu, settleMs: 1_000, verify: sheetOpenedAndClosed("Menu") },
  { name: "open-realm", play: goTo("Realm", "hex"), settleMs: 8_000, verify: inScene("hex") },
  { name: "return-to-map", play: goTo("Map", "map"), settleMs: 8_000, verify: inScene("map") },
  { name: "steady", settleMs: 60_000, verify: inScene("map") },
];

/**
 * The map at its closest view with nothing pressed, recorded frame by frame: where a still view keeps changing (shadow
 * edges, water, smoke, flags), each pixel's count of changed frames, to compare two builds on the same view.
 */
const STILL_MAP_STEPS = [
  { name: "realm-idle", settleMs: 8_000, verify: inScene("hex") },
  { name: "open-map", play: goTo("Map", "map"), settleMs: 6_000, verify: inScene("map") },
  { name: "zoom-in", play: zoomAllTheWayIn, settleMs: 5_000, verify: zoomedAllTheWayIn },
  { name: "still", play: recordTheStillMap, settleMs: 0, verify: recordedStill },
];

/**
 * What a signed-in player does: realm, map, select the readiest army, read production, then a tile tapped for the army
 * while its order is in flight (its next order) in each way that order can leave, and two explores.
 */
const PLAYER_STEPS = [
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

function panned(onMap) {
  return async ({ seen, played, screenshot }) => {
    const viewChange = await meanViewChange(played.before, screenshot);
    const scene = onMap({ seen });
    if (scene.status !== "completed") return { ...scene, viewChange };
    return viewChange >= PAN_VIEW_CHANGE_MIN
      ? completed({ viewChange })
      : failed(`the view barely changed (${viewChange} < ${PAN_VIEW_CHANGE_MIN}): the camera did not move`, {
          viewChange,
        });
  };
}

/** The same view with nothing pressed: how much the map's own animation changes it, the floor a pan must clear. */
async function keepTheViewBefore({ extraScreenshot }) {
  return { before: extraScreenshot("before") };
}

function idledOn(onMap) {
  return async ({ seen, played, screenshot }) => {
    const viewChange = await meanViewChange(played.before, screenshot);
    return { ...onMap({ seen }), viewChange };
  };
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

function zoomedOutAndIn(onMap) {
  return ({ seen, played }) => {
    const scene = onMap({ seen });
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
  };
}

async function zoomAllTheWayIn({ browser }) {
  browser.run(["eval", `void window.__playtest.wheel(-100, ${ZOOM_IN_NOTCHES})`]);
  await sleep(ZOOM_SETTLE_MS);
  return { distance: browser.observe().worldmapDistance };
}

/** On the map at the closest camera distance, read after the wheel: a missing or other distance is not the closest view. */
function zoomedAllTheWayIn({ seen, played }) {
  const scene = inScene("map")({ seen });
  if (scene.status !== "completed") return scene;
  const distance = played?.distance;
  if (typeof distance !== "number" || !Number.isFinite(distance)) {
    return failed(`no camera distance was read after zooming in (${distance})`, played);
  }
  return Math.abs(distance - CLOSEST_CAMERA_DISTANCE) <= CLOSEST_DISTANCE_TOLERANCE
    ? completed(played)
    : failed(`the camera stopped at distance ${distance}, not the closest (${CLOSEST_CAMERA_DISTANCE})`, played);
}

async function recordTheStillMap({ base, devTools, owner }) {
  const recorded = await recordFrames(devTools, owner, `${base}-frames`, STILL_FRAMES_MS);
  return { ...recorded, changes: await measureFrameChanges(`${base}-frames`, `${base}-changes.png`) };
}

function recordedStill({ seen, played }) {
  const scene = inScene("map")({ seen });
  if (scene.status !== "completed") return scene;
  return played.frames >= STILL_FRAMES_MIN
    ? completed(played)
    : failed(`only ${played.frames} frames in ${STILL_FRAMES_MS} ms (< ${STILL_FRAMES_MIN})`, played);
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
 * What the ownership rings cost a player: the map with nothing selected, then their realm selected (every hex its owner
 * holds ringed), held, and panned so terrain pages land under the rings, then the selection cleared. The realm is at the
 * centre once the map opens on it.
 */
const OWNERSHIP_RING_STEPS = [
  { name: "realm-idle", settleMs: 8_000, verify: inScene("hex") },
  { name: "open-map", play: goTo("Map", "map"), settleMs: 6_000, verify: inScene("map") },
  { name: "unselected-idle", play: clearTheSelection, settleMs: 10_000, verify: nothingSelected },
  { name: "select-realm", play: tapTheCentre, settleMs: 5_000, verify: ownRealmSelected },
  { name: "selected-idle", settleMs: 10_000, verify: ownRealmSelected },
  { name: "selected-pan", play: panTheMap, settleMs: 17_000, verify: pannedWithOwnRealmSelected },
  { name: "cleared-idle", play: clearTheSelection, settleMs: 10_000, verify: nothingSelected },
];

/**
 * A seated Blitz player's orders and the army's selection through them. On the map Tab selects the readiest army, and a
 * right-click on a tile it can reach sends its move or explore at once. Each order is held at the network while the
 * step reads the selection, then let go. The army stays selected through the order's confirmation and is offered its
 * next orders from where it then stands, so a second order goes without selecting it again. A refused order leaves it
 * selected where it stood; one deselected while its order is in flight is not selected again at the outcome.
 */
const BLITZ_ORDER_STEPS = [
  { name: "open-world", play: toTheWorldMap, settleMs: 3_000, verify: drawn("map") },
  { name: "select-army", play: selectTheArmyByTab, settleMs: 2_000, verify: armyOfferedOrders },
  { name: "order-kept", play: orderThroughItsOutcome, settleMs: 2_000, verify: keptThroughItsOutcome },
  { name: "second-order", play: orderThroughItsOutcome, settleMs: 2_000, verify: keptThroughItsOutcome },
  { name: "order-refused", play: refuseAnOrder, settleMs: 2_000, verify: keptWhereItStood },
  // Long enough for the order let go after the Escape to be confirmed.
  { name: "deselect-in-flight", play: deselectWhileInFlight, settleMs: 20_000, verify: notSelectedAgain },
];

/** What a Blitz spectator does: the world map, idle, panned, zoomed out and in, then a minute of watching. */
const BLITZ_SPECTATOR_STEPS = [
  { name: "open-world", play: toTheWorldMap, settleMs: 3_000, verify: drawn("map") },
  { name: "map-idle", play: keepTheViewBefore, settleMs: 10_000, verify: idledOn(drawn("map")) },
  { name: "pan", play: panTheMap, settleMs: 17_000, verify: panned(drawn("map")) },
  { name: "zoom", play: zoomOutAndIn, settleMs: 1_000, verify: zoomedOutAndIn(drawn("map")) },
  { name: "steady", settleMs: 60_000, verify: drawn("map") },
];

/** Blitz switches between the world map and the realm's tiles with V (the header's Local / World). */
async function toTheWorldMap({ browser }) {
  const onMap = (seen) => seen.playable && seen.scene === "map" && seen.rendered === "map";
  for (let presses = 0; presses <= PLACE_PRESSES; presses += 1) {
    if (await waitFor(browser, onMap, SCENE_WAIT_MS)) return { presses };
    browser.press("v");
  }
  return { presses: PLACE_PRESSES };
}

/** The route's scene and the scene the renderer last drew agree: Blitz has no place bar to light. */
function drawn(scene) {
  return ({ seen }) =>
    seen.scene === scene && seen.rendered === scene
      ? completed({ scene })
      : failed(
          `expected the ${scene} scene, saw the route on ${seen.scene ?? "no scene"}, ${seen.rendered ?? "no scene"} drawn`,
        );
}

/** Tab selects (and centres) the next army that can act; its orders are planned once it is selected. */
async function selectTheArmyByTab({ browser }) {
  browser.press("Tab");
  await waitFor(browser, (seen) => seen.selection?.army?.orders > 0, ORDER_OUTCOME_WAIT_MS);
  return { army: browser.observe().selection?.army ?? null };
}

function armyOfferedOrders({ seen, played }) {
  if (!seen.selection) return failed(NO_SELECTION_REPORT);
  if (!played.army) return blocked("Tab selected no army: none can act");
  if (!(played.army.orders > 0)) return blocked("the selected army is offered no order", { army: played.army });
  return completed({ army: played.army });
}

/**
 * Right-clicks a tile the selected army can reach, with no selection of its own: the army must still be selected from
 * the step before. The order is held at the network while the selection is read, let go, and its outcome awaited: the
 * army offered orders again, or no longer selected.
 */
async function orderThroughItsOutcome({ browser, devTools }) {
  return orderTheSelectedArmy({ browser, devTools }, async (gate) => {
    await gate.release();
    return {};
  });
}

/** As an order, but answered as the node refusing it; the client's log of that refusal is the step's own. */
async function refuseAnOrder({ browser, devTools }) {
  return orderTheSelectedArmy({ browser, devTools }, async (gate) => ({
    provokedErrors: refusalErrors(await linesLoggedDuring(browser, () => gate.refuse())),
  }));
}

/** Escape while the order is held clears the selection (a step back at a time); the order is then let go. */
async function deselectWhileInFlight({ browser, devTools }) {
  return orderTheSelectedArmy({ browser, devTools, awaitsOutcome: false }, async (gate) => {
    let escapes = 0;
    while (browser.observe().selection?.army && escapes < ESCAPES_TO_DESELECT) {
      browser.press("Escape");
      escapes += 1;
    }
    const deselected = browser.observe().selection?.army === null;
    await gate.release();
    return { escapes, deselected };
  });
}

async function orderTheSelectedArmy({ browser, devTools, awaitsOutcome = true }, whileHeld) {
  const before = browser.observe().selection?.army ?? null;
  if (!before) return { before };
  const { target, scanned } = await findOrderTile(browser);
  if (!target) return { before, scanned };
  const gate = await openOrderSendGate(devTools);
  try {
    browser.rightClick(target.offset);
    const sent = await waitUntil(() => gate.held() > 0, ORDER_SEND_WAIT_MS);
    if (!sent) return { before, scanned, target, sent };
    const inFlight = browser.observe().selection?.army ?? null;
    const held = await whileHeld(gate);
    if (!awaitsOutcome) return { before, scanned, target, sent, inFlight, ...held };
    const settled = (seen) => !seen.selection?.army || seen.selection.army.orders > 0;
    await waitFor(browser, settled, ORDER_OUTCOME_WAIT_MS);
    return { before, scanned, target, sent, inFlight, after: browser.observe().selection?.army ?? null, ...held };
  } finally {
    await gate.close();
  }
}

/** Hovers tiles around the army until one's tooltip offers it a move or an explore, as a player reads it. */
async function findOrderTile(browser) {
  const scanned = [];
  for (const offset of ORDER_TILE_CANDIDATES) {
    browser.hover(offset);
    await sleep(HOVER_SETTLE_MS);
    const verb = browser.read(ORDER_TOOLTIP_TITLE);
    scanned.push({ offset, verb });
    if (verb === "Move" || verb === "Explore") return { target: { offset, verb }, scanned };
  }
  return { target: null, scanned };
}

// The army's ring, then the ring past it: a moved army may stand a tile off the centre.
const ORDER_TILE_CANDIDATES = [...NEIGHBOUR_RING, ...NEIGHBOUR_RING.map(([dx, dy]) => [dx * 2, dy * 2])];

// The hover tooltip's title (Move, Explore, Attack…), shown over a tile the selected army has an order on.
const ORDER_TOOLTIP_TITLE = `JSON.stringify((() => {
  const hint = [...document.querySelectorAll("span")].find((span) => span.textContent.trim() === "Right-click to confirm");
  let tooltip = hint;
  while (tooltip && !tooltip.querySelector("span.px-1")) tooltip = tooltip.parentElement;
  return tooltip?.querySelector("span.px-1")?.textContent.trim() ?? null;
})())`;

/**
 * The army kept selected through an order's confirmation: selected when the step began (no click or Tab in between),
 * while the order was in flight, and after it, offered orders from the tile the order took it to; the order sent and
 * confirmed.
 */
function keptThroughItsOutcome({ played, actionLatency, window }) {
  const sent = judgeSentOrder(played);
  if (sent) return sent;
  const orders = describeOrders({ armyTrace: actionLatency.armyMovement, ...window });
  const confirmed = orders.commands.filter((command) => command.hash && command.confirmed).length;
  if (confirmed !== 1) return failed(`${confirmed} orders were sent and confirmed, not 1`, { orders });
  const { before, after } = played;
  if (after?.id !== before.id) return failed("the army was not selected after its order's outcome", { before, after });
  if (sameHex(after.hex, before.hex)) {
    return failed("the army is not offered orders from the tile its order took it to", { before, after });
  }
  if (!(after.orders > 0)) return failed("the army was offered no orders after its outcome", { before, after });
  return completed({ before, inFlight: played.inFlight, after, target: played.target, orders });
}

/** A refused order leaves the army selected where it stood, offered its orders again, and nothing confirmed. */
function keptWhereItStood({ played, actionLatency, window }) {
  const sent = judgeSentOrder(played);
  if (sent) return sent;
  const orders = describeOrders({ armyTrace: actionLatency.armyMovement, ...window });
  if (orders.commands.some((command) => command.confirmed))
    return failed("the refused order was confirmed", { orders });
  const { before, after } = played;
  if (after?.id !== before.id)
    return failed("the army was not selected after its order was refused", { before, after });
  if (!sameHex(after.hex, before.hex)) return failed("the army moved on a refused order", { before, after });
  if (!(after.orders > 0)) return failed("the army was offered no orders after the refusal", { before, after });
  return completed({ before, after, orders });
}

/** An army deselected while its order was in flight stays unselected once that order is confirmed. */
function notSelectedAgain({ seen, played, actionLatency, window }) {
  const sent = judgeSentOrder(played);
  if (sent) return sent;
  if (!played.deselected)
    return failed(`${played.escapes} Escapes left the army selected while its order was in flight`);
  const orders = describeOrders({ armyTrace: actionLatency.armyMovement, ...window });
  const confirmed = orders.commands.filter((command) => command.hash && command.confirmed).length;
  if (confirmed !== 1) return failed(`${confirmed} orders were sent and confirmed, not 1`, { orders });
  if (seen.selection?.army)
    return failed("the army was selected again at its order's outcome", { army: seen.selection.army });
  return completed({ escapes: played.escapes, orders });
}

/** Why an order step has no order to judge: no army selected, no tile offering one, or nothing sent. */
function judgeSentOrder(played) {
  if (!played.before) return failed("no army was selected when the step began: the step before left none selected");
  if (!played.target) {
    return blocked(
      `no tile around the army offered a move or an explore (${played.scanned.map(({ verb }) => verb ?? "nothing").join(", ")})`,
    );
  }
  if (!played.sent) return failed("the right-click sent no order");
  if (played.inFlight?.id !== played.before.id) {
    return failed("the army was not selected while its order was in flight", { inFlight: played.inFlight });
  }
  return null;
}

const sameHex = (left, right) => left?.col === right?.col && left?.row === right?.row;

/** The step lists a run can play, by name, each with its game; a run plays its role's list unless it names another. */
export const STEP_SETS = {
  spectator: { game: FRONTIER, steps: SPECTATOR_STEPS },
  player: { game: FRONTIER, steps: PLAYER_STEPS },
  "ownership-rings": { game: FRONTIER, steps: OWNERSHIP_RING_STEPS },
  "blitz-orders": { game: BLITZ, steps: BLITZ_ORDER_STEPS },
  "blitz-spectator": { game: BLITZ, steps: BLITZ_SPECTATOR_STEPS },
  "still-map": { game: FRONTIER, steps: STILL_MAP_STEPS },
};

/**
 * The player's own realm selected on the map, and the hexes its owner holds ringed, as the page reports its selection
 * (`window.__eternumMapSelection`); the verdict keeps that report, ring population included.
 */
function ownRealmSelected({ seen }) {
  const onMap = inScene("map")({ seen });
  if (onMap.status !== "completed") return onMap;
  const { selection } = seen;
  if (!selection) return failed(NO_SELECTION_REPORT);
  if (!selection.structure)
    return failed(`no structure is selected (hex ${JSON.stringify(selection.hex)})`, { selection });
  if (!selection.structure.realm || !selection.structure.ownedByViewer) {
    return failed(`structure ${selection.structure.id} is selected, not the player's own realm`, { selection });
  }
  if (!(selection.ringedHexes >= 1)) return failed("the selected realm's holdings are not ringed", { selection });
  return completed({ selection });
}

async function pannedWithOwnRealmSelected(input) {
  const pan = await panned(inScene("map"))(input);
  if (pan.status !== "completed") return pan;
  const selected = ownRealmSelected(input);
  return selected.status === "completed"
    ? completed({ ...pan, ...selected })
    : { ...selected, viewChange: pan.viewChange };
}

/** Nothing selected on the map and nothing ringed. */
function nothingSelected({ seen }) {
  const onMap = inScene("map")({ seen });
  if (onMap.status !== "completed") return onMap;
  const { selection } = seen;
  if (!selection) return failed(NO_SELECTION_REPORT);
  if (selection.hex || selection.structure || selection.ringedHexes > 0) {
    return failed("the map still holds a selection or rings", { selection });
  }
  return completed({ selection });
}

const NO_SELECTION_REPORT =
  "the page reports no map selection (window.__eternumMapSelection): this build cannot show it";

/** Escape steps back: a pinned order, then the selection. */
async function clearTheSelection({ browser }) {
  browser.press("Escape");
  browser.press("Escape");
  return {};
}

async function tapTheCentre({ browser }) {
  browser.tap([0, 0]);
  return {};
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
