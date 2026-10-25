import sharp from "sharp";

import {
  blocked,
  completed,
  describeOrders,
  failed,
  judgeBurst,
  judgeExplore,
  judgeNextOrder,
  judgePlateStamina,
  refusalErrors,
} from "./evidence.mjs";
import { openOrderSendGate, VIEWPORT } from "./browser-session.mjs";
import { measureFrameChanges, recordFrames } from "./frames.mjs";
import { judgePlates, PLATES_EXPRESSION } from "./plates.mjs";
import { judgeHudLayout } from "./hud-layout.mjs";

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
// The map's farthest camera distance with labels drawn: WORLDMAP_CAMERA_ZOOM.maxDistance, held equal by a test.
export const FARTHEST_CAMERA_DISTANCE = 45;
// A still map's frames: long enough to span several of the sun's shadow steps, few enough to keep as evidence.
const BURST_ARMIES_MAX = 6;
const BURST_SELECT_WAIT_MS = 5_000;
const BURST_POLL_MS = 10;
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

/**
 * What a spectator does: enter on the map (every Frontier session opens there), move the camera, read the season,
 * switch scenes, watch.
 */
export const SPECTATOR_STEPS = [
  { name: "enter-on-map", settleMs: 8_000, verify: inScene("map") },
  { name: "hud-layout", play: readTheHudLayout, settleMs: 0, verify: hudLaidOut(inScene("map")) },
  { name: "map-idle", play: keepTheViewBefore, settleMs: 10_000, verify: idledOn(inScene("map")) },
  { name: "pan", play: panTheMap, settleMs: 17_000, verify: panned(inScene("map")) },
  { name: "zoom", play: zoomOutAndIn, settleMs: 1_000, verify: zoomedOutAndIn(inScene("map")) },
  { name: "season", play: readTheSeason, settleMs: 1_000, verify: seasonReadAndClosed },
  { name: "open-feed-event", play: openAFeedEvent, settleMs: 3_000, verify: openedInThePage },
  { name: "visit-realm", play: visitOtherRealms, settleMs: 0, verify: visitedInThePage },
  { name: "open-realm", play: goTo("Realm", "hex"), settleMs: 8_000, verify: inScene("hex") },
  { name: "return-to-map", play: goTo("Map", "map"), settleMs: 8_000, verify: inScene("map") },
  { name: "steady", settleMs: 60_000, verify: inScene("map") },
];

/**
 * The map with nothing pressed, recorded frame by frame at the default view (Medium) and at the closest (Close, where
 * structures cast their shadows too): where a still view keeps changing (shadow edges, water, smoke, flags), each
 * pixel's count of changed frames, to compare two builds on the same view. `opening` reaches the map in the steps'
 * mode and `onMap` is that mode's check that it is drawn.
 */
const stillMapSteps = ({ opening, onMap }) => [
  ...opening,
  { name: "still-medium", play: recordTheStillMap, settleMs: 0, verify: recordedStill(onMap) },
  { name: "zoom-in", play: zoomAllTheWayIn, settleMs: 5_000, verify: zoomedAllTheWayIn(onMap) },
  { name: "still-close", play: recordTheStillMap, settleMs: 0, verify: recordedStill(onMap) },
];

/**
 * The same still map with the sun held where it stands (the dev tools' Time Scrubber, Override Time): whatever still
 * changes on the map does so without the sun moving.
 */
const frozenSunStillMapSteps = ({ opening, onMap }) => [
  ...opening,
  { name: "freeze-sun", play: holdTheSun, settleMs: 3_000, verify: heldTheSun(onMap) },
  ...stillMapSteps({ opening: [], onMap }),
];

const FRONTIER_MAP = {
  opening: [{ name: "enter-on-map", settleMs: 8_000, verify: inScene("map") }],
  onMap: inScene("map"),
};
const BLITZ_MAP = {
  opening: [{ name: "open-world", play: toTheWorldMap, settleMs: 3_000, verify: drawn("map") }],
  onMap: drawn("map"),
};

/**
 * What a signed-in player does: realm, map, select the readiest army, read its Wheat store, then a tile tapped for the army
 * while its order is in flight (its next order) in each way that order can leave, and two explores.
 */
const PLAYER_STEPS = [
  { name: "enter-on-map", settleMs: 8_000, verify: inScene("map") },
  { name: "hud-layout", play: readTheHudLayout, settleMs: 0, verify: hudLaidOut(inScene("map")) },
  { name: "select-army", play: selectTheReadiestArmy, settleMs: 3_000, verify: armySelected },
  { name: "wheat-store", play: openAndCloseWheatStore, settleMs: 1_000, verify: storeOpenedAndClosed },
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
      pressPlace(browser, place);
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
  seen.scene === scene &&
  seen.rendered === scene &&
  [place, PLACE_TABS[place]].some((name) => Boolean(name && seen.place?.startsWith(name)));

/**
 * A place as the top bar's Realm / World names it: a desktop's HUD, every mode's, moves between the map and the realm
 * there; a phone's Frontier HUD has its own place bar's Map and Realm.
 */
const PLACE_TABS = { Map: "World", Realm: "Realm" };

/** Presses the place bar's button where there is one (a phone), else the top bar's tab (a desktop). */
function pressPlace(browser, place) {
  try {
    browser.click(place);
  } catch {
    browser.clickTab(PLACE_TABS[place]);
  }
}

/** Where the HUD's standing parts sit on the map at rest. */
async function readTheHudLayout({ browser }) {
  return { layout: browser.hudLayout() };
}

/** The HUD laid out on the map (judgeHudLayout): its parts drawn, whole on the page, apart, each control reachable. */
function hudLaidOut(onMap) {
  return ({ seen, played }) => {
    const scene = onMap({ seen });
    return scene.status === "completed" ? judgeHudLayout(played.layout) : scene;
  };
}

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

async function zoomAllTheWayOut({ browser }) {
  browser.run(["eval", `void window.__playtest.wheel(100, ${ZOOM_IN_NOTCHES})`]);
  await sleep(ZOOM_SETTLE_MS);
  return { distance: browser.observe().worldmapDistance };
}

/** On the map at the closest camera distance, read after the wheel: a missing or other distance is not the closest view. */
function zoomedAllTheWayIn(onMap) {
  return zoomedTo(onMap, CLOSEST_CAMERA_DISTANCE, "closest");
}

/** On the map at the farthest camera distance the wheel reaches, where labels are still drawn. */
function zoomedAllTheWayOut(onMap) {
  return zoomedTo(onMap, FARTHEST_CAMERA_DISTANCE, "farthest");
}

function zoomedTo(onMap, target, name) {
  return ({ seen, played }) => {
    const scene = onMap({ seen });
    if (scene.status !== "completed") return scene;
    const distance = played?.distance;
    if (typeof distance !== "number" || !Number.isFinite(distance)) {
      return failed(`no camera distance was read after zooming (${distance})`, played);
    }
    return Math.abs(distance - target) <= CLOSEST_DISTANCE_TOLERANCE
      ? completed(played)
      : failed(`the camera stopped at distance ${distance}, not the ${name} (${target})`, played);
  };
}

async function recordTheStillMap({ base, devTools, owner }) {
  const recorded = await recordFrames(devTools, owner, `${base}-frames`, STILL_FRAMES_MS);
  return { ...recorded, changes: await measureFrameChanges(`${base}-frames`, `${base}-changes.png`) };
}

/** Ticks the dev tools' Override Time, which holds the day at its current progress. */
async function holdTheSun({ browser }) {
  return { held: browser.read(HOLD_THE_SUN_EXPRESSION) };
}

const HOLD_THE_SUN_EXPRESSION = `JSON.stringify((() => {
  const control = [...document.querySelectorAll(".lil-gui .controller")].find(
    (controller) => controller.querySelector(".name")?.textContent.trim() === "Override Time",
  );
  const box = control?.querySelector("input[type=checkbox]");
  if (!box) return false;
  if (!box.checked) box.click();
  return box.checked;
})())`;

function heldTheSun(onMap) {
  return ({ seen, played }) => {
    const scene = onMap({ seen });
    if (scene.status !== "completed") return scene;
    return played.held ? completed(played) : failed("the dev tools offer no Override Time to hold the sun", played);
  };
}

function recordedStill(onMap) {
  return ({ seen, played }) => {
    const scene = onMap({ seen });
    if (scene.status !== "completed") return scene;
    return played.frames >= STILL_FRAMES_MIN
      ? completed(played)
      : failed(`only ${played.frames} frames in ${STILL_FRAMES_MS} ms (< ${STILL_FRAMES_MIN})`, played);
  };
}

/**
 * The season's board as a player reads it: on a desktop its round place opens it as a page and a second press closes
 * it; a phone has it in the Menu, closed with Escape.
 */
async function readTheSeason(input) {
  if (!onADesktop()) return { desktop: false, ...(await readTheSeasonInTheMenu(input)) };
  const { browser } = input;
  browser.click("Season");
  await sleep(2_000);
  const opened = browser.observe();
  browser.click("Season");
  await sleep(1_000);
  return { desktop: true, opened, closed: browser.observe() };
}

/** The route's hex as the address names it: normalized, the same place on every client. */
const ROUTE_HEX_EXPRESSION = `JSON.stringify((() => {
  const query = new URLSearchParams(location.search);
  return query.has("col") && query.has("row") ? { col: Number(query.get("col")), row: Number(query.get("row")) } : null;
})())`;

/** How far apart two route hexes are, along the larger axis; the map redraws around a place past 8,192 hexes. */
const hexesApart = (from, to) =>
  from && to ? Math.max(Math.abs(from.col - to.col), Math.abs(from.row - to.row)) : null;

/**
 * The Feed's first story that still opens a place (one from a closed Frontier day is no link), pressed as a player
 * presses it: the map goes where it happened. Frontier's realms stand millions of hexes apart, so a story of another
 * realm is a far jump.
 */
async function openAFeedEvent({ browser }) {
  const before = browser.observe();
  const from = browser.read(ROUTE_HEX_EXPRESSION);
  // A row's button is named by its words, time and line run together; the browser presses the first one where it is.
  const row = browser.read(`JSON.stringify(document.querySelector(".ui-event__open")?.textContent.trim() ?? null)`);
  if (!row) return { row: null };
  browser.run(["click", ".ui-event__open"]);
  await waitFor(browser, (seen) => seen.playable && seen.scene === "map", SCENE_WAIT_MS);
  const to = browser.read(ROUTE_HEX_EXPRESSION);
  return { row, from, to, apart: hexesApart(from, to), reloaded: browser.observe().timeOrigin !== before.timeOrigin };
}

/**
 * A story opens in the page, never by loading it again, on the map at the story's place, with what is there selected:
 * the selected tile (a contract hex) is the route's (a normalized hex), one map centre apart on both axes.
 */
function openedInThePage({ seen, played }) {
  if (!played.row) return blocked("the Feed showed no story that opens a place", played);
  if (played.reloaded) return failed("the page loaded again to open the story", played);
  if (!played.to) return failed("the story's address names no hex", played);
  const scene = inScene("map")({ seen });
  if (scene.status !== "completed") return scene;
  const missed = placeMissed(seen, played.to);
  return missed ? failed(`the story's place: ${missed}`, played) : completed(played);
}

/**
 * Why the map does not stand on a link's place, or null: that tile is selected (a contract hex, one map centre from the
 * address's normalized hex on both axes) and the camera looks at it.
 */
function placeMissed(seen, address) {
  const hex = seen.selection?.hex;
  if (!hex) return "nothing was selected";
  if (hex.col - address.col !== hex.row - address.row)
    return `the selected tile ${JSON.stringify(hex)} is not the address's ${JSON.stringify(address)}`;
  const camera = seen.selection?.camera;
  if (camera?.col !== hex.col || camera?.row !== hex.row)
    return `the camera looks at ${JSON.stringify(camera ?? null)}, not the selected tile ${JSON.stringify(hex)}`;
  return null;
}

/**
 * Other realms visited from the Season's board, one after the other, as a player does: its second row, then its third
 * (the board's leader is the realm a spectator watches first), each by Visit, the realm it opens, then the world map
 * on it. The second visit is the one that follows another realm.
 */
async function visitOtherRealms({ browser }) {
  const visits = [];
  for (const index of [1, 2]) {
    const visit = await visitRow(browser, index);
    visits.push(visit);
    if (!visit.row) break;
  }
  return { visits };
}

async function visitRow(browser, index) {
  const before = browser.observe();
  const from = browser.read(ROUTE_HEX_EXPRESSION);
  if (onADesktop()) browser.click("Season");
  else {
    browser.click("Menu");
    await sleep(1_500);
    browser.click("Season");
  }
  await sleep(2_000);
  const rows = `[...document.querySelectorAll('button[aria-label^="#"]')].map((row) => row.getAttribute("aria-label"))`;
  const row = browser.read(`JSON.stringify(${rows})`)[index] ?? null;
  if (!row) return { row: null };
  browser.click(row);
  await sleep(1_500);
  browser.click("Visit");
  const realm = await arrives(browser, "Realm", "hex");
  const realmHex = browser.read(ROUTE_HEX_EXPRESSION);
  pressPlace(browser, "Map");
  const map = await arrives(browser, "Map", "map");
  const mapHex = browser.read(ROUTE_HEX_EXPRESSION);
  const seen = browser.observe();
  return {
    row,
    realm,
    map,
    realmHex,
    mapHex,
    apart: hexesApart(from, mapHex),
    reloaded: seen.timeOrigin !== before.timeOrigin,
    seen,
  };
}

/**
 * Each visit opened the realm and then the map on it, in the page: never loaded again, never elsewhere, the visited
 * realm selected and the camera on it, whatever realm came before.
 */
function visitedInThePage({ played }) {
  const [first] = played.visits;
  if (!first?.row) return blocked("the Season's board listed no other realm to visit", played);
  for (const [index, visit] of played.visits.entries()) {
    const missed = visitMissed(visit);
    if (missed) return failed(`visit ${index + 1} (${visit.row ?? "no row"}): ${missed}`, played);
  }
  return completed(played);
}

/** Why a visit did not land on its realm in the page, or null. */
function visitMissed(visit) {
  if (!visit.row) return "the Season's board listed no realm to visit";
  if (visit.reloaded) return "the page loaded again";
  if (!visit.realm) return "the realm never opened";
  if (!visit.map) return "the map never opened on it";
  if (hexesApart(visit.realmHex, visit.mapHex) !== 0)
    return `the map opened at ${JSON.stringify(visit.mapHex)}, not the realm's ${JSON.stringify(visit.realmHex)}`;
  const scene = inScene("map")({ seen: visit.seen });
  if (scene.status !== "completed") return scene.reason;
  const realm = visit.seen.selection?.structure;
  if (!realm?.realm || realm.ownedByViewer) return "it is not the realm selected";
  return placeMissed(visit.seen, visit.mapHex);
}

/** A desktop's Season page drew with its place pressed, then closed; a phone's Menu sheet opened, then closed. */
function seasonReadAndClosed({ played, ...rest }) {
  if (!played.desktop) return sheetOpenedAndClosed("Menu")({ played, ...rest });
  if (!played.opened.page || !played.opened.pressed.includes("Season"))
    return failed("the Season place opened no page", { played });
  if (played.closed.page) return failed("the Season page did not close", { played });
  return completed(played);
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

/** A Wheat ring or phone plate opens its store card; pressing it again closes the same card. */
async function openAndCloseWheatStore({ browser }) {
  const card = () => browser.read(`Boolean(document.querySelector('section[aria-label="Wheat"]'))`);
  browser.run(["find", "role", "button", "click", "--name", "Wheat"]);
  await sleep(1_500);
  const opened = card();
  browser.run(["find", "role", "button", "click", "--name", "Wheat"]);
  await sleep(1_000);
  return { opened, closed: card() };
}

function storeOpenedAndClosed({ played }) {
  if (!played.opened) return failed("the Wheat store card did not open");
  if (played.closed) return failed("the Wheat store card did not close");
  return completed(played);
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

/**
 * Centres the army and explores a tile beside it as a player does: on a desktop, hovers its neighbours until one's
 * tooltip offers Explore and right-clicks it (the map's own order, as in Blitz); on a phone, taps them until one offers
 * Explore on the order bar and confirms it, other offers cancelled.
 */
async function exploreBesideArmy({ browser, extraScreenshot }) {
  const army = await focusTheReadiestArmy(browser);
  if (!army) return { offered: [], army };
  if (onADesktop()) {
    const { target, scanned } = await findOrderTile(browser, "Explore");
    const offered = scanned.map(({ verb }) => verb);
    if (!target) return { army, offered };
    const before = extraScreenshot("before");
    const pressedAt = browser.observe().now;
    browser.rightClick(target.offset);
    return { army, offered, pressedAt, before, target: target.offset };
  }
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

/**
 * The client's record of the explore, the screen around the explored tile before Enter against after settling, and the
 * army's plate read while it settled.
 */
async function explored({ played, actionLatency, screenshot, probe }) {
  const tileChange = played.before ? await meanViewChange(played.before, screenshot, tileRegion(played.target)) : null;
  return judgeExplore({ ...played, tileChange, plateStamina: probe.plateStamina }, actionLatency.clientActions);
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
  { name: "enter-on-map", settleMs: 8_000, verify: inScene("map") },
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

/**
 * Orders as fast as a player's keys: every army's order tile is found first, then each army is taken with Tab and
 * ordered with a right-click, back to back through DevTools input, nothing held. Each order is timed to its army moving.
 */
const BLITZ_BURST_STEPS = [
  { name: "open-world", play: toTheWorldMap, settleMs: 3_000, verify: drawn("map") },
  {
    name: "burst",
    play: orderEveryArmyAtOnce,
    settleMs: 15_000,
    verify: ({ played, actionLatency }) => judgeBurst(played, actionLatency),
  },
];

/** What a Blitz spectator does: the world map, idle, panned, zoomed out and in, then a minute of watching. */
const BLITZ_SPECTATOR_STEPS = [
  { name: "open-world", play: toTheWorldMap, settleMs: 3_000, verify: drawn("map") },
  { name: "map-idle", play: keepTheViewBefore, settleMs: 10_000, verify: idledOn(drawn("map")) },
  { name: "pan", play: panTheMap, settleMs: 17_000, verify: panned(drawn("map")) },
  { name: "zoom", play: zoomOutAndIn, settleMs: 1_000, verify: zoomedOutAndIn(drawn("map")) },
  { name: "steady", settleMs: 60_000, verify: drawn("map") },
];

/**
 * The map's labels in a live Blitz or Frontier game, opened with the dev overlays (the page then reports its world, so
 * each label is measured against its thing as the renderer places it) (map labels, owner 2026-10-19: "the label placement on the map need
 * work"): read at the map's own zoom, then with each tile round the centre hovered (its plate opens in its token's
 * place), then the same at the farthest zoom and at the closest. No reading may hold a label on its thing or away from
 * it (owner, 2026-10-20), a token, plate or order line over or crowding another, or an opened plate away from its token. A seated player's list first takes the readiest army with Tab, so each hovered
 * tile also shows the army's order line beside it.
 */
const plateSteps = ({ opening, onMap }, { selectArmy }) => {
  const selectTheArmy = selectArmy
    ? [{ name: "select-army", play: selectTheArmyByTab, settleMs: 2_000, verify: armyOfferedOrders }]
    : [];
  // A click at each label, then the readiest army taken again for a seated player's next hovers.
  const clickThrough = (name) => [
    { name, play: clickThroughTheLabels, settleMs: 0, verify: clicksLandedBeneath },
    ...selectTheArmy.map((step) => ({ ...step, name: `${name}-select-army` })),
  ];
  return [
    ...opening,
    ...selectTheArmy,
    { name: "plates", play: readThePlates({ hover: false }), settleMs: 0, verify: platesClear },
    { name: "plates-hovered", play: readThePlates({ hover: true }), settleMs: 0, verify: platesClear },
    ...clickThrough("labels-click-through"),
    { name: "zoom-out", play: zoomAllTheWayOut, settleMs: 1_000, verify: zoomedAllTheWayOut(onMap) },
    { name: "plates-far", play: readThePlates({ hover: false }), settleMs: 0, verify: platesClear },
    { name: "plates-far-hovered", play: readThePlates({ hover: true }), settleMs: 0, verify: platesClear },
    ...clickThrough("labels-click-through-far"),
    { name: "zoom-in", play: zoomAllTheWayIn, settleMs: 1_000, verify: zoomedAllTheWayIn(onMap) },
    { name: "plates-close", play: readThePlates({ hover: false }), settleMs: 0, verify: platesClear },
    { name: "plates-close-hovered", play: readThePlates({ hover: true }), settleMs: 0, verify: platesClear },
    ...clickThrough("labels-click-through-close"),
  ];
};

/** Long enough for a frame to place the plates after the view or the hovered tile changed. */
const PLATES_SETTLE_MS = 1_500;

/**
 * The labels as drawn, once on the still view, or once per tile of the ring round the centre with it hovered, after a
 * reading before any hover: each opened plate is measured against its token there.
 */
const readThePlates =
  ({ hover }) =>
  async ({ browser, extraScreenshot }) => {
    const before = hover ? browser.read(PLATES_EXPRESSION) : null;
    const readings = [];
    for (const offset of hover ? NEIGHBOUR_RING : [null]) {
      if (offset) browser.hover(offset);
      await sleep(PLATES_SETTLE_MS);
      readings.push({ offset, seen: browser.read(PLATES_EXPRESSION) });
      if (offset) extraScreenshot(`hover-${offset.join("_")}`);
    }
    return { before, readings };
  };

/** How many labels in view a click-through step clicks at, and how long a click's selection takes to land. */
const LABEL_CLICKS = 6;
const CLICK_SETTLE_MS = 1_200;

/**
 * A real click at the middle of each label in view, then the same click with the label layer hidden: labels never take
 * a click, so each pair must select the same tile, the one under the pointer (owner, 2026-10-20: "I wanna remove the
 * clicking the label select the structure/army [...] we click the tile and that's it").
 */
async function clickThroughTheLabels({ browser, extraScreenshot }) {
  const seen = browser.read(PLATES_EXPRESSION);
  const page = browser.read("JSON.stringify({ width: innerWidth, height: innerHeight })");
  const layer = (visibility) =>
    browser.run(["eval", `void document.querySelector(".mp")?.style.setProperty("visibility", "${visibility}")`]);
  const offsetOf = ({ x, y }) => [Math.round(x - page.width / 2), Math.round(y - page.height / 2)];
  const clicks = [];
  for (const [index, label] of (seen?.things ?? [])
    .filter((thing) => thing.kind !== "order line")
    .slice(0, LABEL_CLICKS)
    .entries()) {
    const middle = offsetOf({ x: label.x + label.w / 2, y: label.y + label.h / 2 });
    // From no selection: with one standing, a hovered tile shows the order line, and a token under it steps aside.
    for (let press = 0; press < ESCAPES_TO_DESELECT; press += 1) browser.press("Escape");
    browser.tap(middle);
    await sleep(CLICK_SETTLE_MS);
    const shown = browser.observe().selection?.hex ?? null;
    extraScreenshot(`click-${index}`);
    layer("hidden");
    try {
      browser.tap(middle);
      await sleep(CLICK_SETTLE_MS);
    } finally {
      layer("");
    }
    clicks.push({
      label: label.text || label.kind,
      kind: label.kind,
      at: middle,
      shown,
      expected: browser.observe().selection?.hex ?? null,
    });
  }
  browser.press("Escape");
  return { clicks };
}

/** Every click at a label selected the tile beneath it, as the same click with the labels hidden did. */
function clicksLandedBeneath({ played }) {
  if (played.clicks.length === 0) return blocked("no map label is drawn in view to click at");
  const same = (a, b) => a !== null && b !== null && a.col === b.col && a.row === b.row;
  const off = played.clicks.filter((click) => !same(click.shown, click.expected));
  return off.length === 0
    ? completed({ clicks: played.clicks })
    : failed(`${off.length} clicks at a label did not select the tile beneath it`, {
        clicks: played.clicks,
        off,
      });
}

/** Every reading of the step clear: the first that is not names the step's failure, with what it saw. */
function platesClear({ played }) {
  const verdicts = played.readings.map(({ offset, seen }) => ({ offset, ...judgePlates(seen, played.before) }));
  return verdicts.find((verdict) => verdict.status !== "completed") ?? completed({ readings: verdicts });
}

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

async function orderEveryArmyAtOnce({ browser, devTools }) {
  const targets = await findEveryArmysOrderTile(browser);
  const startedAt = browser.observe().now;
  const burst = [];
  for (const { army, offset } of targets) {
    if (!(await tabToArmy(devTools, army, targets.length))) break;
    await rightClickThroughDevTools(devTools, offset);
    burst.push({ army, offset });
  }
  return { targets, startedAt, burst };
}

/** Each army Tab lands on, once round the cycle, with a tile it can be ordered to. */
async function findEveryArmysOrderTile(browser) {
  const targets = [];
  const visited = new Set();
  for (let tabs = 0; tabs < BURST_ARMIES_MAX; tabs += 1) {
    const before = browser.observe().selection?.army?.id ?? null;
    browser.press("Tab");
    const landed = (seen) => seen.selection?.army?.id !== before && seen.selection?.army?.orders > 0;
    if (!(await waitFor(browser, landed, BURST_SELECT_WAIT_MS))) break;
    const army = browser.observe().selection.army.id;
    if (visited.has(army)) break;
    visited.add(army);
    const { target } = await findOrderTile(browser);
    if (target) targets.push({ army, offset: target.offset });
  }
  return targets;
}

/** Presses Tab until it lands on `army` with its orders planned, as fast as the page selects. */
async function tabToArmy(devTools, army, tabsMax) {
  for (let tabs = 0; tabs < tabsMax; tabs += 1) {
    const before = (await selectedArmy(devTools))?.id ?? null;
    await pressThroughDevTools(devTools, "Tab", 9);
    const landed = await pollDevTools(async () => {
      const selected = await selectedArmy(devTools);
      return selected?.id !== before && selected?.orders > 0 ? selected : null;
    }, BURST_SELECT_WAIT_MS);
    if (landed?.id === army) return true;
  }
  return false;
}

const selectedArmy = async (devTools) => {
  const { result } = await devTools.send("Runtime.evaluate", {
    expression: "window.__eternumMapSelection?.army ?? null",
    returnByValue: true,
  });
  return result.value;
};

async function pressThroughDevTools(devTools, key, keyCode) {
  for (const type of ["keyDown", "keyUp"]) {
    await devTools.send("Input.dispatchKeyEvent", { type, key, code: key, windowsVirtualKeyCode: keyCode });
  }
}

async function rightClickThroughDevTools(devTools, [dx, dy]) {
  const point = { x: VIEWPORT.width / 2 + dx, y: VIEWPORT.height / 2 + dy };
  await devTools.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devTools.send("Input.dispatchMouseEvent", { type, ...point, button: "right", buttons: 2, clickCount: 1 });
  }
}

async function pollDevTools(read, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await read();
    if (value) return value;
    await sleep(BURST_POLL_MS);
  }
  return null;
}

/**
 * Hovers tiles around the army until one's tooltip offers it one of `verbs` (a move or an explore), as a player reads
 * it.
 */
async function findOrderTile(browser, ...verbs) {
  const wanted = verbs.length > 0 ? verbs : ["Move", "Explore"];
  const scanned = [];
  for (const offset of ORDER_TILE_CANDIDATES) {
    browser.hover(offset);
    await sleep(HOVER_SETTLE_MS);
    const verb = browser.read(ORDER_TOOLTIP_TITLE);
    scanned.push({ offset, verb });
    if (wanted.includes(verb)) return { target: { offset, verb }, scanned };
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
function keptThroughItsOutcome({ seen, played, actionLatency, window, probe }) {
  const sent = judgeSentOrder(played);
  if (sent) return sent;
  const orders = describeOrders({ armyTrace: actionLatency.armyMovement, ...window });
  const confirmed = orders.commands.filter((command) => command.hash && command.confirmed).length;
  if (confirmed !== 1) return failed(`${confirmed} orders were sent and confirmed, not 1`, { orders });
  const { before, after } = played;
  if (after?.id !== before.id) return failed("the army was not selected after its order's outcome", { before, after });
  // A move always takes the army; an explore that reveals an occupant (a rift, a camp) leaves it where it stood.
  if (played.target?.verb !== "Explore" && sameHex(after.hex, before.hex)) {
    return failed("the army is not offered orders from the tile its order took it to", { before, after });
  }
  if (!(after.orders > 0)) return failed("the army was offered no orders after its outcome", { before, after });
  const reported = selectionOffTheArmy(seen, after);
  if (reported) return reported;
  // The army walked to its order's tile with its plate open: the plate reads its bar through the walk.
  const stale = judgePlateStamina(probe.plateStamina ?? [], window.from, { before, after });
  if (stale) return stale;
  return completed({ before, inFlight: played.inFlight, after, target: played.target, orders });
}

/**
 * The page's last selection report after the step, which the tile panel reads: the army the step ordered still
 * selected, and the selected hex on that army's tile. This checks the reported selection the panel reads, not the
 * panel's rendered title.
 */
function selectionOffTheArmy(seen, expected) {
  const selection = seen.selection;
  if (!selection) return failed("the page reported no map selection after the step");
  const { hex, army } = selection;
  if (!army) return failed(`the page's last report has no army selected, not army ${expected.id}`, { selection });
  if (army.id !== expected.id) {
    return failed(`the page's last report has army ${army.id} selected, not army ${expected.id}`, { selection });
  }
  if (sameHex(hex, army.hex)) return null;
  return failed(
    `the tile panel names ${hex ? `(${hex.col}, ${hex.row})` : "no tile"}, not the selected army's tile ` +
      `(${army.hex.col}, ${army.hex.row})`,
    { hex, army },
  );
}

/** A refused order leaves the army selected where it stood, offered its orders again, and nothing confirmed. */
function keptWhereItStood({ seen, played, actionLatency, window }) {
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
  const reported = selectionOffTheArmy(seen, after);
  if (reported) return reported;
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

/** Read the production renderer after user camera controls have requested each skin LOD. */
const knightSteps = ({ opening, onMap }) => [
  ...opening,
  { name: "knight-gameplay", play: readKnightPresentation, settleMs: 0, verify: knightPresented(onMap) },
  { name: "knight-zoom-close", play: zoomAllTheWayIn, settleMs: 3000, verify: zoomedAllTheWayIn(onMap) },
  { name: "knight-close", play: readKnightPresentation, settleMs: 0, verify: knightPresented(onMap) },
];

async function readKnightPresentation({ browser }) {
  await sleep(3000);
  return {
    stats: browser.read("window.getProceduralArmyProductionStats?.() ?? null"),
    assets: browser.read("JSON.parse(window.__playtest.read()).models"),
  };
}

function knightPresented(onMap) {
  return ({ seen, played }) => {
    const scene = onMap({ seen });
    if (scene.status !== "completed") return scene;
    const unrelated = played.assets.filter(
      ({ url }) => isProceduralUnitAsset(url) && !url.includes("/t1-knight-default/"),
    );
    if (unrelated.length) return failed("Knight view fetched unrelated unit families", played);
    const stats = played.stats;
    if (!stats) return failed("production character report missing");
    if (stats.loadState === "failed") return failed("Knight asset loading failed", played);
    if (stats.visibleArmyCount === 0) return blocked("no T1 Knights in this camera's view", played);
    if (stats.fallbackRepresentationCount !== 0)
      return failed("a visible Knight is still using the replaced model", played);
    if (stats.nearKnightCount + stats.midKnightCount !== stats.actorCount)
      return failed("Knight LOD count does not match actors", played);
    const triangles = stats.nearKnightCount * 14999 + stats.midKnightCount * 5998;
    return stats.meshDrawsPerPass === stats.actorCount * 3 && stats.trianglesPerPass === triangles
      ? completed(played)
      : failed("Knight render budget does not match the delivered meshes", played);
  };
}

async function openEmptyMap({ browser, devTools }) {
  const target = new URL(browser.run(["get", "url"]));
  target.pathname = target.pathname.replace(/\/hex$/, "/map");
  target.searchParams.set("col", String(Number(target.searchParams.get("col")) + 24));
  target.searchParams.set("row", String(Number(target.searchParams.get("row")) + 24));
  target.searchParams.set("boot", "direct");
  target.searchParams.delete("resumeScene");
  await devTools.send("Network.clearBrowserCache");
  browser.run(["open", target.href]);
  await waitFor(browser, (seen) => seen.playable && isIn(seen, "Map", "map"), PLAYABLE_WAIT_MS);
  return readKnightPresentation({ browser });
}

function noOffscreenUnitDownloads({ seen, played }) {
  const scene = inScene("map")({ seen });
  if (scene.status !== "completed") return scene;
  if (!played.stats || played.stats.visibleArmyCount !== 0)
    return failed("expected a map without visible Knights", played);
  const families = played.assets.filter(({ url }) => isProceduralUnitAsset(url));
  return families.length === 0 ? completed(played) : failed("off-screen unit families were fetched", played);
}

function noHiddenUnitDownloads({ seen, played }) {
  const scene = inScene("hex")({ seen });
  if (scene.status !== "completed") return scene;
  const families = played.assets.filter(({ url }) => isProceduralUnitAsset(url));
  return families.length === 0 ? completed(played) : failed("hidden map fetched unit families", played);
}

function isProceduralUnitAsset(url) {
  return url.startsWith("/models/characters/") || url.startsWith("/models/boats/");
}

/**
 * The lab's spire game (/lab/game?scenario=spire, src/lab/game): the game's own route, scenes, HUD and client on a
 * fixture chain held in the tab, whose account records each command the game signs and whose Herald answers it as the
 * contract applies it. Its realm's spire is lit with Ethereal I and II researched, and its army stands beside it.
 */
const LAB_SPIRE = { mode: "frontier", lab: "spire", chainId: "0x1ab9", gameId: 1, card: FRONTIER.card };

/**
 * A realm's spire as a player uses it, at either size: the army selected from the dock, the spire found beside it by
 * its hover, tapped for its card (the army kept as its actor, each researched depth with its stamina and Enter, the next
 * one's research, and what entering commits the army to), then Enter on Ethereal II: the command the game signs, and
 * the army in Ethereal II.
 */
const LAB_SPIRE_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "select-army", play: selectTheReadiestArmy, settleMs: 1_500, verify: armySelected },
  { name: "find-spire", play: findTheSpire, settleMs: 0, verify: spireFound },
  { name: "spire-card", play: tapTheSpire, settleMs: 0, verify: spireCardOffersDepths },
  { name: "enter-depth", play: enterEtherealII, settleMs: 0, verify: armyEnteredEtherealII },
];

const SPIRE_ORDER = "Enter a depth";
// The pointer's tooltip, read whole: Frontier's names the order on its first line ("Enter a depth").
const TILE_TOOLTIP = `JSON.stringify(document.querySelector('[role="tooltip"]')?.innerText.replace(/\\s+/g, " ").trim() ?? null)`;
const SPIRE_STATE = `JSON.stringify({
  sheet: document.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null,
  depths: [...document.querySelectorAll("[data-spire-depths] .ui-row")].map((row) => ({
    depth: row.querySelector(".ui-row__title")?.textContent ?? null,
    line: row.querySelector(".ui-row__detail")?.textContent ?? null,
    button: row.querySelector("button")?.textContent ?? null,
    enabled: row.querySelector("button")?.disabled === false,
  })),
  commitment: document.querySelector("[data-spire-commitment]")?.textContent ?? null,
  text: document.querySelector("[data-kit-sheet]")?.innerText.replace(/\\s+/g, " ").trim() ?? null,
  army: window.__eternumMapSelection?.army ?? null,
  sent: (window.__labChain?.sent ?? []).map(({ hash, command }) => ({ hash, ...command })),
})`;

/** Hovers the selected army's neighbours until one's tooltip offers the spire's order. */
async function findTheSpire({ browser }) {
  const scanned = [];
  for (const offset of NEIGHBOUR_RING) {
    browser.hover(offset);
    await sleep(HOVER_SETTLE_MS);
    const tip = browser.read(TILE_TOOLTIP);
    scanned.push({ offset, tip });
    if (tip === SPIRE_ORDER) return { spire: offset, scanned };
  }
  return { spire: null, scanned };
}

function spireFound({ played }) {
  return played.spire
    ? completed({ spire: played.spire, scanned: played.scanned })
    : failed(`no tile beside the army offers "${SPIRE_ORDER}"`, { scanned: played.scanned });
}

/** Taps the tile whose hover offers the spire's order, as a player taps what they see. */
async function tapTheSpire({ browser }) {
  const { spire, scanned } = await findTheSpire({ browser });
  if (!spire) return { spire, scanned };
  browser.tap(spire);
  const state = await readUntil(
    () => browser.read(SPIRE_STATE),
    (shown) => shown.sheet !== null,
    SPIRE_WAIT_MS,
  );
  return { spire, scanned, state };
}

function spireCardOffersDepths({ played, seen }) {
  if (!played.spire) return failed(`no tile beside the army offers "${SPIRE_ORDER}"`, { scanned: played.scanned });
  const shown = { ...played.state, pressed: seen.pressed };
  if (shown.sheet !== "Spire") return failed(`the tap opened ${shown.sheet ?? "no card"}, not the spire's`, shown);
  if (!shown.army) return failed("the tap on the spire dropped the army", shown);
  const offered = shown.depths.map(({ depth, line, button, enabled }) => `${depth}|${line}|${button}|${enabled}`);
  const expected = [
    "Ethereal I|30 stamina|Enter|true",
    "Ethereal II|40 stamina|Enter|true",
    "Ethereal III|Research it to open it|Research|true",
  ];
  if (JSON.stringify(offered) !== JSON.stringify(expected))
    return failed(`the card offers ${offered.join(", ")}`, shown);
  if (
    !/^Entering keeps .+ in that depth for the rest of the day \(.+ left\): there is no way back up$/.test(
      shown.commitment ?? "",
    )
  )
    return failed("the card does not say what entering commits the army to", shown);
  return completed(shown);
}

/** Presses Enter on Ethereal II, then reads the card and the army once the command's answer has moved the army. */
async function enterEtherealII({ browser }) {
  const before = browser.read(SPIRE_STATE);
  browser.click("Enter Ethereal II");
  const moved = (shown) => shown.sent.length > before.sent.length && shown.army?.hex.row !== before.army?.hex.row;
  const after = await readUntil(() => browser.read(SPIRE_STATE), moved, ORDER_OUTCOME_WAIT_MS);
  return { before, after };
}

/** The command the game signed for the press, and the army it moved, shown in Ethereal II. */
function armyEnteredEtherealII({ played }) {
  const { before, after } = played;
  const command = after.sent.at(-1);
  if (after.sent.length !== before.sent.length + 1 || command?.kind !== "EnterDepth")
    return failed("Enter sent no EnterDepth command", { before, after });
  if (Number(command.fields.explorer_id) !== before.army?.id || command.fields.depth !== "2")
    return failed(`EnterDepth was sent for ${JSON.stringify(command.fields)}`, { before, after });
  // Two regions of Frontier's hundred rows straight below where it stood.
  if (after.army?.hex.col !== before.army.hex.col || after.army.hex.row - before.army.hex.row !== 200)
    return failed("the army did not land in Ethereal II", { before, after });
  if (!/is in Ethereal II until the day ends/.test(after.text ?? ""))
    return failed("the card does not show the army in Ethereal II", { before, after });
  return completed({ command, before: before.army, after: after.army, card: after.text });
}

const SPIRE_WAIT_MS = 5_000;

const labDayTurn = (scenario) => ({
  mode: "frontier",
  lab: scenario,
  chainId: "0x1ab9",
  gameId: 1,
  card: FRONTIER.card,
});

/**
 * Realm 7's day 2 ending on prod's recorded history (src/lab/game/day-turn-scenario.ts), in the session (day-turn,
 * day-turn-slow) or before it opened (day-later, day-later-short), the map opened where the realm stood on day 2: the
 * summary rises with what the player's history gives of day 2, and Continue brings the camera onto the realm's day-3
 * site.
 */
const labDayTurnSteps = (expected) => [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "day-summary", play: readTheDaySummary, settleMs: 0, verify: summaryShows(expected) },
  { name: "continue", play: continueIntoTheNewDay, settleMs: 0, verify: cameraOnTheNewSite },
];

/** Prod's leading player's own day 2: 35 reveals and 5 sites cleared, paying 7,246 Essence and 524 Labor. */
const RECORDED_DAY_2 = {
  totals: ["35Reveals", "5Sites cleared", "0Chests", "+7,246Essence", "+524Labor", "+0LORDS"],
  notice: null,
};
/** Day 2 past the history read: each total a dash, and the card says why. */
const DAY_2_OUT_OF_REACH = {
  totals: ["—Reveals", "—Sites cleared", "—Chests", "—Essence", "—Labor", "—LORDS"],
  notice: "Your history no longer reaches back to this day's start, so its totals are unknown.",
};
/** Realm 7's site on day 3 of the lab's calendar: its region's column, four regions a day down (contract hexes). */
const LAB_DAY_3_SITE = { col: 650, row: 850 };
/** The live turn waits for the day's last seconds and the mist, and a slow history for its answer after the moment. */
const DAY_SUMMARY_WAIT_MS = 90_000;
const NEW_DAY_WAIT_MS = 20_000;
/** The camera's hex is reported at most every 100 ms. */
const CAMERA_REPORT_MS = 1_000;
const DAY_END_STATE = `JSON.stringify({
  phase: document.querySelector("[data-day-end]")?.dataset.dayEnd ?? "day",
  card: document.querySelector("section[aria-label$=' done']")?.getAttribute("aria-label") ?? null,
  totals: [...document.querySelectorAll("section[aria-label$=' done'] [data-total]")].map((cell) => cell.textContent),
  notice: document.querySelector("section[aria-label$=' done'] .ui-notice")?.textContent ?? null,
  camera: window.__eternumMapSelection?.camera ?? null,
})`;

/** Waits for the ended day's summary over the map, and reads it and where the camera looks. */
async function readTheDaySummary({ browser }) {
  return readUntil(
    () => browser.read(DAY_END_STATE),
    (shown) => shown.card !== null,
    DAY_SUMMARY_WAIT_MS,
  );
}

function summaryShows(expected) {
  return ({ played }) => {
    if (played.card !== "Day 2 done") return failed(`the summary shown is ${played.card ?? "none"}`, played);
    if (JSON.stringify(played.totals) !== JSON.stringify(expected.totals))
      return failed(`the summary counts ${played.totals.join(", ")}`, played);
    if (played.notice !== expected.notice)
      return failed(
        `the summary says ${JSON.stringify(played.notice)}, not ${JSON.stringify(expected.notice)}`,
        played,
      );
    return completed(played);
  };
}

/** Presses Continue, waits for the screen to come back up on the new day, and reads where the camera looks. */
async function continueIntoTheNewDay({ browser }) {
  const before = browser.read(DAY_END_STATE);
  browser.click("Continue");
  await readUntil(
    () => browser.read(DAY_END_STATE),
    (shown) => shown.phase === "day",
    NEW_DAY_WAIT_MS,
  );
  await sleep(CAMERA_REPORT_MS);
  return { before, after: browser.read(DAY_END_STATE) };
}

function cameraOnTheNewSite({ played }) {
  const { before, after } = played;
  if (after.phase !== "day") return failed(`the screen is still on the day's end (${after.phase})`, played);
  const on = after.camera;
  if (!on || Math.abs(on.col - LAB_DAY_3_SITE.col) > 1 || Math.abs(on.row - LAB_DAY_3_SITE.row) > 1)
    return failed(
      `the camera looks at ${JSON.stringify(on)}, not the realm's day-3 site ${JSON.stringify(LAB_DAY_3_SITE)}`,
      played,
    );
  return completed({ before: before.camera, after: on, site: LAB_DAY_3_SITE });
}

/** Reads the page until what it shows is done, or the time is up; the last reading either way. */
async function readUntil(read, done, timeoutMs) {
  const startedAt = Date.now();
  let shown = read();
  while (!done(shown) && Date.now() - startedAt < timeoutMs) {
    await sleep(POLL_MS);
    shown = read();
  }
  return shown;
}

/** The step lists a run can play, by name, each with its game; a run plays its role's list unless it names another. */
export const STEP_SETS = {
  spectator: { game: FRONTIER, steps: SPECTATOR_STEPS },
  "unit-assets-spectator": {
    game: FRONTIER,
    steps: [
      { name: "no-knight-realm", play: readKnightPresentation, settleMs: 0, verify: noHiddenUnitDownloads },
      ...knightSteps({ opening: [FRONTIER_MAP.opening[1]], onMap: FRONTIER_MAP.onMap }),
      { name: "no-knight-map", play: openEmptyMap, settleMs: 0, verify: noOffscreenUnitDownloads },
    ],
  },
  "knight-spectator": { game: FRONTIER, steps: knightSteps(FRONTIER_MAP) },
  "knight-blitz-spectator": { game: BLITZ, steps: knightSteps(BLITZ_MAP) },
  player: { game: FRONTIER, steps: PLAYER_STEPS },
  "ownership-rings": { game: FRONTIER, steps: OWNERSHIP_RING_STEPS },
  "blitz-orders": { game: BLITZ, steps: BLITZ_ORDER_STEPS },
  "blitz-spectator": { game: BLITZ, steps: BLITZ_SPECTATOR_STEPS },
  "blitz-burst": { game: BLITZ, steps: BLITZ_BURST_STEPS },
  "blitz-plates": { game: BLITZ, steps: plateSteps(BLITZ_MAP, { selectArmy: false }), devOverlays: true },
  "blitz-plates-player": { game: BLITZ, steps: plateSteps(BLITZ_MAP, { selectArmy: true }), devOverlays: true },
  "frontier-plates": { game: FRONTIER, steps: plateSteps(FRONTIER_MAP, { selectArmy: false }), devOverlays: true },
  "frontier-plates-player": {
    game: FRONTIER,
    steps: plateSteps(FRONTIER_MAP, { selectArmy: true }),
    devOverlays: true,
  },
  "lab-spire": { game: LAB_SPIRE, steps: LAB_SPIRE_STEPS },
  "lab-day-turn": { game: labDayTurn("day-turn"), steps: labDayTurnSteps(RECORDED_DAY_2) },
  "lab-day-later": { game: labDayTurn("day-later"), steps: labDayTurnSteps(RECORDED_DAY_2) },
  "lab-day-turn-slow": { game: labDayTurn("day-turn-slow"), steps: labDayTurnSteps(RECORDED_DAY_2) },
  "lab-day-later-short": { game: labDayTurn("day-later-short"), steps: labDayTurnSteps(DAY_2_OUT_OF_REACH) },
  "lab-painted-buildings": {
    game: { ...LAB_SPIRE, lab: "painted-buildings" },
    steps: [
      { name: "painted-map", settleMs: 10_000, verify: inScene("map") },
      { name: "painted-board", play: goTo("Realm", "hex"), settleMs: 10_000, verify: inScene("hex") },
      { name: "return-to-map", play: goTo("Map", "map"), settleMs: 3_000, verify: inScene("map") },
    ],
  },
  "still-map": { game: FRONTIER, steps: stillMapSteps(FRONTIER_MAP) },
  "still-map-frozen-sun": { game: FRONTIER, steps: frozenSunStillMapSteps(FRONTIER_MAP), devOverlays: true },
  "blitz-still-map": { game: BLITZ, steps: stillMapSteps(BLITZ_MAP) },
  "blitz-still-map-frozen-sun": { game: BLITZ, steps: frozenSunStillMapSteps(BLITZ_MAP), devOverlays: true },
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
  const play = withOrderInFlight(whileInFlight, { refuse, needsOther });
  return {
    name,
    play: (input) => (onADesktop() ? { desktop: true } : play(input)),
    settleMs: 8_000,
    verify: ({ played, actionLatency, window }) =>
      played.desktop
        ? blocked(DESKTOP_ORDERS)
        : judgeNextOrder({
            expected,
            played,
            orders: describeOrders({ armyTrace: actionLatency.armyMovement, ...window }),
          }),
  };
}

/** A desktop's HUD orders from the map itself, as Blitz's does: a right-click sends at once, nothing is queued. */
const DESKTOP_ORDERS = "a desktop orders from the map at once: the queued next order is a phone's";

/** The run plays at a desktop's width (the HUD's left column and contextual orders). */
const onADesktop = () => VIEWPORT.width >= DESKTOP_MIN_WIDTH;

/** The desktop width the HUD composes for (DESKTOP_MIN_PX). */
const DESKTOP_MIN_WIDTH = 1024;

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
