import sharp from "sharp";

import { blocked, completed, describeBurst, failed, judgeBurst, judgeExplore } from "./evidence.mjs";
import { tapCommands, VIEWPORT } from "./browser-session.mjs";

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
const BURST_TAPS = 5;
const BURST_TARGETS = 2;
// About eight taps a second: a player hammering the map, faster than an order's outcome comes back.
const BURST_PACE_MS = 120;
const TAP_PASSES = 2;
// A pan moves the whole map under the camera; the same view, animated, changes far less (map-idle records that floor).
const PAN_VIEW_CHANGE_MIN = 6;
// The army's six neighbours on screen, in pixels from the centre, at the map's default zoom (a player run never zooms).
const NEIGHBOUR_OFFSETS = [
  [65, -95],
  [70, 100],
  [-67, -95],
  [-75, 100],
  [137, 0],
  [-135, 0],
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

/** What a signed-in player does: realm, map, select the readiest army, read production, explore twice, spam orders. */
export const PLAYER_STEPS = [
  { name: "realm-idle", settleMs: 8_000, verify: inScene("hex") },
  { name: "open-map", play: goTo("Map", "map"), settleMs: 6_000, verify: inScene("map") },
  { name: "select-army", play: selectTheReadiestArmy, settleMs: 3_000, verify: armySelected },
  { name: "production", play: openAndCloseProduction, settleMs: 1_000, verify: sheetOpenedAndClosed("Production") },
  { name: "explore-1", play: exploreBesideArmy, settleMs: 6_000, verify: explored },
  { name: "explore-2", play: exploreBesideArmy, settleMs: 6_000, verify: explored },
  { name: "order-burst", play: orderBurst, settleMs: 8_000, verify: burstPlayed },
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
          `expected the ${scene} scene with ${place} lit, saw ${seen.scene ?? "no scene"} with ${seen.place ?? "nothing"} lit`,
        );
}

const isIn = (seen, place, scene) => seen.scene === scene && Boolean(seen.place?.startsWith(place));

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
  browser.click(readiest.label);
  await sleep(ARMY_FLIGHT_MS);
  return readiest.label;
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
    for (const offset of NEIGHBOUR_OFFSETS) {
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
 * Spams orders the way a player hammering the map does: the army's neighbours are scanned for up to two tiles that offer
 * an order, then five taps with Enter alternate between them BURST_PACE_MS apart, in one batch so nothing slows them.
 * Each tap is taken as offering what its tile offered when scanned; what was sent shows in the army trace.
 */
async function orderBurst({ browser }) {
  const army = await focusTheReadiestArmy(browser);
  if (!army) return { taps: [], army };
  const scanned = [];
  for (const offset of NEIGHBOUR_OFFSETS) {
    browser.tap(offset);
    const verb = orderVerb(browser.buttonTexts());
    scanned.push({ offset, verb });
    if (scanned.filter(offersOrder).length === BURST_TARGETS) break;
  }
  browser.press("Escape");
  const targets = scanned.filter(offersOrder);
  if (targets.length === 0) return { army, scanned, taps: scanned.map(({ verb }) => ({ verb })) };
  const taps = Array.from({ length: BURST_TAPS }, (_, index) => targets[index % targets.length]);
  browser.run([
    "batch",
    ...taps.flatMap(({ offset }, index) => [
      ...(index > 0 ? [`wait ${BURST_PACE_MS}`] : []),
      ...tapCommands(offset),
      "press Enter",
    ]),
  ]);
  return { army, scanned, taps: taps.map(({ offset, verb }) => ({ offset, verb })) };
}

const offersOrder = ({ verb }) => verb === "Explore" || verb === "Move";

function burstPlayed({ played, probe, window, actionLatency }) {
  const burst = describeBurst({
    presses: probe.inputs,
    taps: played.taps,
    armyTrace: actionLatency.armyMovement,
    ...window,
  });
  return { ...judgeBurst({ taps: played.taps, commands: burst.commands }), burst };
}

/** What the order bar offers after a tap: its verb, "short" when it shows a cost not covered (the verb is hidden), or null. */
function orderVerb(buttonTexts) {
  const verb = buttonTexts.map((text) => /^(Explore|Move)/.exec(text)?.[1]).find(Boolean);
  if (verb) return verb;
  return buttonTexts.some((text) => text.startsWith("Cancel")) ? "short" : null;
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
