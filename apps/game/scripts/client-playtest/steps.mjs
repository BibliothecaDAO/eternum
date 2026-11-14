import { ECONOMY_STEPS } from "./economy-steps.mjs";
import depthLooks from "../../src/three/terrain/ethereal-depths.json" with { type: "json" };
import homeIcons from "../../src/ui/design-system/home-icons.json" with { type: "json" };
import { existsSync, writeFileSync } from "node:fs";
import realmAssets from "../../src/three/structures/realm-assets.json" with { type: "json" };
import realmSkins from "../../src/three/structures/realm-skins.json" with { type: "json" };
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
  contextLossErrors,
  compareCensus,
  judgeAfterDoorway,
} from "./evidence.mjs";
import { watchReleaseMove } from "./stale-release.mjs";
import { openOrderSendGate, touchAt, VIEWPORT } from "./browser-session.mjs";
import { ENTRY_BUTTON, findHomeCardEntry } from "./player-entry.mjs";
import { judgeClickToResult, measureClickToResult } from "./click-latency.mjs";
import { proveResultOnScreen, startResultCapture } from "./result-capture.mjs";
import { measureFrameChanges, recordFrames } from "./frames.mjs";
import { againstTheirThings, judgePlates, PLATES_EXPRESSION } from "./plates.mjs";
import { DESKTOP_MIN_WIDTH, judgeHudLayout, MAP_LEAST_SHARE } from "./hud-layout.mjs";

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
/**
 * The words the in-game HUD gives what the steps press and read, as the app writes them (src/ui/design-system/kit/
 * words.ts: MENU, SEASON, EVENTS_WORDS.feed, CLOSE, CHAT); steps.test.mjs fails when they differ (playtest 30 October 2026,
 * B6: the phone's Log became its Feed, and the Season board's Back its ×).
 */
export const HUD_WORDS = {
  menu: "Menu",
  season: "Season",
  feed: "Feed",
  close: "Close",
  chat: "Chat",
  realmLabor: "Realm Labor",
};

// A game's card on Play takes its step by the verb's name (`data-play-verb`, src/shell/play/play-item.tsx).
const FRONTIER = { mode: "frontier", card: { verbs: ["resume", "play"] } };
const BLITZ = { mode: "blitz", card: { verbs: ["enter"] } };

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
 * The world map's frames only: entered, held still, panned and zoomed, as the full walk does them. Short enough to play
 * the same map with the deployed models and with heavier ones (`--model-override`) back to back.
 */
const MAP_FRAME_STEPS = SPECTATOR_STEPS.filter((step) =>
  ["enter-on-map", "map-idle", "pan", "zoom"].includes(step.name),
);

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
 * An action timed from the player's press to its result on screen (owner, 2026-10-28: "I want to reduce as max we can
 * the time between an action submitted and it appearing on the suers screen"). `sends` is the game command it measures
 * (commands.cairo's variant; the lab's relay grant for a labor claim), `press` plays it as a player does and
 * reports the screen region its result shows in; `resultOf` names exactly that result (click-latency.mjs) from what was
 * pressed and what the client and, in the lab, the chain recorded. The step waits long enough for the chain to answer,
 * then cuts the press to the result at each mark the client recorded. With --capture-results it also records the
 * page's frames and fails unless they show the result in its region at its mark (result-capture.mjs).
 */
const clickToResultStep = (name, sends, press, resultOf, { settleMs = RESULT_SETTLE_MS } = {}) => ({
  name,
  sends,
  play: async (context) => {
    const stopCapture = context.captureResults
      ? await startResultCapture(context.devTools, context.browser.observe().timeOrigin)
      : null;
    const chainFrom = context.browser.read(LAB_CHAIN_LENGTH);
    const { locate, ...pressed } = { ...(await press(context)), chainFrom };
    await context.owner.sleep(settleMs);
    // A result whose place is known only once it shows (a deployed army) is found after the settle: reading the page
    // while the frames are recorded would hold their acknowledgements, and the screencast with them.
    const played = locate ? { ...pressed, region: locate() } : pressed;
    if (!stopCapture) return played;
    capturedFrames.set(context.base, await stopCapture());
    return { ...played, capturedAs: context.base };
  },
  settleMs: 0,
  verify: async ({ played, probe, actionLatency, window }) => {
    const result = resultOf({ played, actionLatency, since: window.from });
    if (!result) return judgeClickToResult(played, { missing: ["result"] });
    const measured = measureClickToResult({
      probe,
      actionLatency,
      since: window.from,
      result: { ...result, region: undefined },
    });
    const verdict = sentAsDeclared(judgeClickToResult(played, measured), played, actionLatency, sends);
    if (!played.capturedAs) return verdict;
    const frames = capturedFrames.get(played.capturedAs) ?? [];
    capturedFrames.delete(played.capturedAs);
    if (verdict.status !== "completed") return verdict;
    const place = result.target ?? result.region ?? played.region;
    if (!place) return failed("its result's place on the screen was not found", { clickToResult: measured });
    if (!isOnScreen(place))
      return failed(`its result's place ${JSON.stringify(place)} is not on the screen`, { clickToResult: measured });
    const onScreen = await proveResultOnScreen({
      frames,
      region: result.region ?? played.region,
      target: result.target,
      onset: result.onset,
      before: measured.marks.diff,
      visible: measured.marks.visible,
      pageFrames: probe.frames,
      dir: `${played.capturedAs}-frames`,
    });
    return onScreen.shown
      ? completed({ ...verdict, onScreen })
      : failed(`the screen did not show ${JSON.stringify(result)} at its mark: ${onScreen.reason}`, {
          clickToResult: measured,
          onScreen,
        });
  },
});
/** A box wholly inside the page's viewport: one past its edge is not what the player sees. */
const isOnScreen = ({ left, top, width, height }) =>
  left >= 0 && top >= 0 && left + width <= VIEWPORT.width && top + height <= VIEWPORT.height;

// How many commands the lab's chain has been sent; null outside the lab.
const LAB_CHAIN_LENGTH = `JSON.stringify(window.__labChain ? window.__labChain.sent.length : null)`;

/**
 * In the lab, a step's press must have sent the command it measures (action-coverage.test.ts counts each player command
 * by the step that declares it): one that sent something else measured another action.
 */
const sentAsDeclared = (verdict, played, actionLatency, sends) => {
  if (verdict.status !== "completed" || played.chainFrom == null) return verdict;
  const sent = (actionLatency.chainAnswers ?? []).slice(played.chainFrom).map(({ kind }) => kind);
  return sent.includes(sends)
    ? verdict
    : failed(`the press sent ${sent.join(", ") || "nothing"}, not ${sends}`, played);
};

/** Long enough for a live shard's answer and the frames after it; the lab's chain answers in 300 ms. */
const RESULT_SETTLE_MS = 6_000;
/** A season's entry: the settle answered, then the game booted and the realm drawn, on a throttled phone too. */
const SETTLE_RESULT_MS = 25_000;
/** Frames a step recorded with --capture-results, held until its verdict reads them: never in its transcript. */
const capturedFrames = new Map();

/**
 * The tile an explore targeted, as its own record names it: the one tile its result may show, and on screen, its
 * ground, which must read as explored, not its fog (an outline or a plate changing round it proves nothing).
 */
const exploredTile = ({ played, actionLatency, since }) => {
  const record = (actionLatency.clientActions ?? []).find(
    (action) => action.operation === "explore_reveal" && action.phases.click >= since && action.targetHex,
  );
  return (
    record && {
      presented: `explore:${record.targetHex.col},${record.targetHex.row}`,
      target: played.target && tileInterior(played.target),
    }
  );
};

/** The building the lab's chain wrote for the step's CreateBuilding: its plot and its category. */
const builtBuilding = ({ actionLatency }) => {
  const building = (actionLatency.chainAnswers ?? [])
    .filter(({ kind }) => kind === "CreateBuilding")
    .at(-1)
    ?.answered.find(({ model }) => model === "Building")?.value;
  return building && { presented: `building:${building.inner_col},${building.inner_row}:${building.category}` };
};

/**
 * Every action a player's press sends, each timed from the press to the frame that shows its result: on the map, an
 * explore (its tile's terrain presented) and a move (the army's walk started); in the realm, the castle raised a level
 * (its sheet naming exactly the next level) and a building placed (that building, on that plot, drawn).
 */
const ACTION_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  clickToResultStep("explore", "Explore", exploreBesideArmy, exploredTile),
  clickToResultStep(
    "move",
    "Move",
    (context) => orderBesideArmy(context, "Move"),
    ({ played }) => played.armyId && { presented: `walk:${played.armyId}` },
  ),
  { name: "open-realm", play: goTo("Realm", "hex"), settleMs: 3_000, verify: inScene("hex") },
  clickToResultStep("level-up", "LevelUp", raiseTheCastle, ({ played }) => played.raisedTo && { watch: "level-up" }),
  clickToResultStep("build", "CreateBuilding", buildOnAnOpenPlot, builtBuilding),
];

/**
 * Ethereal II entered through the spire (the lab's spire game): the army selected, the spire beside it tapped for its
 * card, then Enter on Ethereal II; the result is the view switched there with the army standing at its arrival, seen
 * on its figure (no walk crosses the void).
 */
const SPIRE_ACTION_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "select-army", play: selectTheReadiestArmy, settleMs: 1_500, verify: armySelected },
  { name: "spire-card", play: pressSpire, settleMs: 0, verify: spireCardOffersDepths },
  clickToResultStep(
    "enter-depth",
    "EnterDepth",
    enterEtherealIIFromItsCard,
    ({ played }) => played.armyId && { presented: `army-shown:${played.armyId}` },
  ),
];

async function enterEtherealIIFromItsCard({ browser }) {
  const armyId = browser.observe().selection?.army?.id ?? null;
  browser.click("Enter Ethereal II");
  // The view switches to the arrival, so the army's place on screen is read once it stands there.
  const locate = () => {
    const armyAt = armyOnScreen(browser, armyId);
    return armyAt && armyRegion(armyAt);
  };
  return { armyId, locate };
}

const RELIC_FORECAST_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  {
    name: "activate-relics-and-read-forecast",
    settleMs: 0,
    play: async (context) => {
      const { browser, extraScreenshot } = context;
      await pickTheSpireArmy({ browser });
      const before = await openTheRuinsCardUntil(showsBothSides)({
        ...context,
        extraScreenshot: (name) => extraScreenshot(`before-${name}`),
      });
      const beforeText = browser.read(`JSON.stringify(document.querySelector('[data-kit-sheet]')?.textContent ?? '')`);
      browser.press("Escape");
      await openTheArmyPanel(browser);
      for (const [index, name] of ["Uncommon Blade", "Common Tome"].entries()) {
        browser.run(["find", "role", "button", "click", "--name", `Switch on ${name}`]);
        await readUntil(
          () => browser.read(`window.__labChain?.sent.filter(row => row.command.kind === 'ApplyRelic').length ?? 0`),
          (count) => count === index + 1,
          MERGE_WAIT_MS,
        );
        await readUntil(
          () => browser.read(`Boolean(document.querySelector('[data-army-relics] button[disabled]'))`),
          (disabled) => !disabled,
          MERGE_WAIT_MS,
        );
      }
      browser.press("Escape");
      const after = await openTheRuinsCardUntil(showsBothSides)({
        ...context,
        extraScreenshot: (name) => extraScreenshot(`after-${name}`),
      });
      return {
        before: before.after,
        after: after.after,
        beforeText,
        afterText: browser.read(`JSON.stringify(document.querySelector('[data-kit-sheet]')?.textContent ?? '')`),
        sent: browser.read(`window.__labChain?.sent.filter(row => row.command.kind === 'ApplyRelic') ?? []`),
      };
    },
    verify: ({ played }) => {
      const effects = played.sent
        .flatMap((row) => row.answered ?? [])
        .filter((row) => row.model === "ArmyRelicEffect")
        .map((row) => row.value);
      return played.before.sides.length === 2 &&
        played.after.sides.length === 2 &&
        JSON.stringify(played.before.sides) !== JSON.stringify(played.after.sides) &&
        /136\s*XP/.test(played.beforeText) &&
        /190\s*XP/.test(played.afterText) &&
        effects.some((effect) => effect.kind === "Blade" && effect.rank === 2) &&
        effects.some((effect) => effect.kind === "Tome" && effect.rank === 1)
        ? completed(played)
        : failed("switching on Blade and Tome must change the fight and the ruin's XP from 136 to 190", played);
    },
  },
];

/**
 * A fight (the lab's fight game): the army selected, the ruin beside it opened for its card from the tile that offers
 * Attack (a desktop's right-click, a phone's two taps), then the card's Attack; the result is the army's token showing
 * exactly the troops the chain left it.
 */
const FIGHT_ACTION_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "select-army", play: selectTheReadiestArmy, settleMs: 1_500, verify: armySelected },
  clickToResultStep(
    "attack",
    "BattleGuard",
    attackFromTheSiteCard,
    ({ played }) => played.watching && { watch: "fought" },
  ),
];

/**
 * An attack that costs the army its life (the lab's fight-lost game), from the site's card as lab-actions-fight attacks:
 * the loss stands in the panel's place, then the panel closes by itself, nothing left standing for the gone army.
 */
const FIGHT_LOST_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "select-army", play: selectTheReadiestArmy, settleMs: 1_500, verify: armySelected },
  { name: "attack-lost", play: attackAndReadTheLoss, settleMs: 500, verify: lossShown },
  { name: "loss-closes", play: readTheLossClose, settleMs: 500, verify: lossClosed },
];
const ARMY_LOST = "Your army is lost";
/** Past the loss's moment in the panel (ArmyLostSheet's ARMY_LOST_MS, 3 s), with room for a slow frame. */
const LOSS_CLOSES_WAIT_MS = 6_000;

async function attackAndReadTheLoss(context) {
  const attacked = await attackFromTheSiteCard(context);
  const shown = await readUntil(
    () => context.browser.read(MERGE_STATE),
    (state) => state.sheet === ARMY_LOST,
    SHEET_WAIT_MS,
  );
  return { ...attacked, sheet: shown.sheet, sent: shown.sent, destroyed: shown.destroyed };
}

function lossShown({ played }) {
  if (!played.sent?.includes("BattleGuard"))
    return failed(`no attack was sent (offered ${played.offered?.join(", ")})`);
  if (!played.destroyed?.includes(played.army)) return failed(`the chain did not answer ${played.army} lost`);
  return played.sheet === ARMY_LOST
    ? completed({ army: played.army, sheet: played.sheet })
    : failed(`expected "${ARMY_LOST}" in the panel, saw ${played.sheet ?? "no sheet"}`);
}

async function readTheLossClose({ browser }) {
  const shown = await readUntil(
    () => browser.read(MERGE_STATE),
    (state) => state.sheet === null,
    LOSS_CLOSES_WAIT_MS,
  );
  return { sheet: shown.sheet, selected: browser.observe().selection?.army ?? null };
}

function lossClosed({ played }) {
  if (played.sheet !== null) return failed(`expected the panel closed after the loss, saw ${played.sheet}`);
  return played.selected === null
    ? completed({ closed: true })
    : failed(`expected no army selected after its loss, saw ${JSON.stringify(played.selected)}`);
}

async function attackFromTheSiteCard({ browser }) {
  const army = browser.observe().selection?.army?.id;
  const armyAt = armyOnScreen(browser, army);
  if (!army || !armyAt) return { army, offered: [] };
  const target = await findTheAttack(browser, armyAt);
  if (!target.offset) return { army, offered: target.offered };
  if (onADesktop()) browser.rightClick(target.offset);
  else if (!target.opened) browser.tap(target.offset);
  const sheet = await readUntil(
    () => browser.read(MERGE_STATE),
    (shown) => shown.buttons.includes("Attack"),
    SHEET_WAIT_MS,
  );
  if (!sheet.buttons.includes("Attack")) return { army, offered: target.offered, target: target.offset, sheet };
  const token = browser.read(armyToken(army));
  watchFor(browser, "fought", tokensShowTheChainsCounts("BattleGuard"));
  browser.click("Attack");
  return { army, offered: target.offered, target: target.offset, watching: true, region: token?.region };
}

/**
 * The tile beside the army that offers Attack: a desktop reads each one's hover; a phone taps each one, and a site's
 * tap opens its card (or an order bar naming Attack, which a second tap opens).
 */
async function findTheAttack(browser, armyAt) {
  if (onADesktop()) {
    const { target, scanned } = await findOrderTile(browser, ["Attack"], armyAt);
    return { offset: target?.offset, offered: scanned.map((seen) => seen.verb) };
  }
  const offered = [];
  for (const [dx, dy] of NEIGHBOUR_RING) {
    const offset = [armyAt[0] + dx, armyAt[1] + dy];
    browser.tap(offset);
    await sleep(HOVER_SETTLE_MS);
    if (browser.read(MERGE_STATE).buttons.includes("Attack")) return { offset, offered, opened: true };
    const offer = orderVerb(browser.orderBar());
    offered.push(offer);
    if (offer === "Attack") return { offset, offered };
    if (!browser.observe().selection?.army) await focusTheArmyFromItsDock(browser);
  }
  return { offset: null, offered };
}

/** An army's mark on the map (its token, or its plate while open): its box on the page, read before its result changes it. */
const armyToken = (army) => `JSON.stringify((() => {
  const rect = document.querySelector('.mp-at[data-key="army:${army}"]')?.firstElementChild?.getBoundingClientRect();
  return rect ? { region: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } } : null;
})())`;

/**
 * Every army the lab chain's last `kind` answer wrote troops for shows exactly that count on its token, as the token
 * writes a count: the fight's attacker, both armies of a transfer.
 */
const tokensShowTheChainsCounts = (kind) => `(() => {
  const answer = (window.__labChain?.sent ?? []).filter(({ command }) => command.kind === "${kind}").at(-1);
  const rows = (answer?.answered ?? []).filter(({ model, value }) => model === "ExplorerTroops" && value !== null);
  return rows.length > 0 && rows.every(({ value }) =>
    document.querySelector('.mp-at[data-key="army:' + value.explorer_id + '"] .mp-count')?.textContent ===
      (BigInt(value.troops.count) / 1000000000n).toLocaleString("en-US"));
})()`;

/**
 * A Shrine and a Well used (the lab's sites game): each beside the army, used as a player uses it (a desktop's
 * right-click on the tile whose hover offers Use and what it gives; a phone's tap, which opens the site's sheet, then
 * Use); the result is that site leaving the map from its tile.
 */
const SITE_ACTION_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "select-army", play: selectTheReadiestArmy, settleMs: 1_500, verify: armySelected },
  clickToResultStep(
    "shrine",
    "InteractSite",
    (context) => useTheSite(context, "Shrine", "III skill point"),
    shrinePointGranted,
  ),
  clickToResultStep("well", "InteractSite", (context) => useTheSite(context, "Well", "+97 stamina"), wellRefilled),
];

async function useTheSite({ browser }, site, gives) {
  await focusTheArmyFromItsDock(browser);
  const armyAt = armyOnScreen(browser, browser.observe().selection?.army?.id);
  if (!armyAt) return { site, offered: [] };
  const offered = [];
  for (const [dx, dy] of NEIGHBOUR_RING) {
    const offset = [armyAt[0] + dx, armyAt[1] + dy];
    if (onADesktop()) {
      browser.hover(offset);
      await sleep(HOVER_SETTLE_MS);
      const tip = browser.read(TOOLTIP_TEXT);
      offered.push(tip);
      if (/^Use\b/.test(tip ?? "") && tip.includes(gives)) {
        browser.rightClick(offset);
        return { site, offered, target: offset, region: tileRegion(offset) };
      }
      continue;
    }
    browser.tap(offset);
    const sheet = await readUntil(
      () => browser.read(SHEET_NAME),
      (name) => name !== null,
      SHEET_WAIT_MS,
    );
    offered.push(sheet);
    if (sheet === site) {
      // A phone frames the tapped tile above the site's sheet: its result shows where the map now draws it.
      const at = await settledHexOnScreen(browser);
      browser.click("Use");
      return { site, offered, target: offset, region: at && tileRegionAt(at) };
    }
    if (sheet !== null) browser.press("Escape");
    if (!browser.observe().selection?.army) await focusTheArmyFromItsDock(browser);
  }
  return { site, offered };
}

// The pointer's tooltip whole: its order, then what it costs or gives ("Use", "III skill point").
const TOOLTIP_TEXT = `JSON.stringify(document.querySelector('[role="tooltip"][aria-hidden="false"]')?.innerText.replace(/\\s+/g, " ").trim() ?? null)`;

/** The discovery fixture promises one III point; using it leaves the army's XP alone. */
function shrinePointGranted(context) {
  const answer = (context.actionLatency.chainAnswers ?? []).filter(({ kind }) => kind === "InteractSite").at(-1);
  const progress = answer?.answered.find(({ model }) => model === "ArmyProgress")?.value;
  const consumed = answer?.answered.some(({ model, value }) => model === "ShrineReward" && value === null);
  if (
    !consumed ||
    progress?.xp !== 40 ||
    progress?.rare_points !== 1 ||
    progress.common_points !== 0 ||
    progress.uncommon_points !== 0 ||
    progress.epic_points !== 0 ||
    progress.legendary_points !== 0
  )
    return false;
  return siteUsedUp(context);
}

/** Logistics III raises the bar to 195; the Well adds floor(195 / 2) to its 40 stamina. */
function wellRefilled(context) {
  const answer = (context.actionLatency.chainAnswers ?? []).filter(({ kind }) => kind === "InteractSite").at(-1);
  const slot = answer?.answered.find(({ model }) => model === "ArmySlot")?.value;
  if (BigInt(slot?.stamina.amount ?? 0) !== 137n) return false;
  return siteUsedUp(context);
}

/** The site the lab's chain consumed for the step's InteractSite: its tile, vacated. */
function siteUsedUp({ actionLatency }) {
  const vacated = (actionLatency.chainAnswers ?? [])
    .filter(({ kind }) => kind === "InteractSite")
    .at(-1)
    ?.answered.find(({ model, value }) => model === "TileOccupancy" && value === null);
  const [, , col, row] = vacated?.key.split(":") ?? [];
  return col && { presented: `site-gone:${col},${row}` };
}

/**
 * Two of the realm's armies merged (the lab's merge game): the spire's army picked, the other right-clicked for the
 * transfer card, then its Merge; the result is the army the chain removed leaving the map.
 */
function mergeActionSteps() {
  const tiles = { byArmy: null };
  return [
    { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
    { name: "pick-army", play: pickTheSpireArmy, settleMs: 0, verify: spireArmyPicked },
    { name: "open-merge", play: (context) => openTheMerge(context, tiles), settleMs: 0, verify: mergeCardOpen },
    clickToResultStep("merge", "ManageTroops", (context) => mergeTheArmies(context, tiles), mergedAway),
  ];
}

/**
 * Presses the transfer card's merge, then confirms it as a player does: a merge that costs the army its XP asks once
 * more ("Lose 100 XP, merge into Army 2"), and that second press sends it. Each is pressed where it is drawn.
 */
async function mergeTheArmies({ browser }, tiles) {
  const merge = browser.read(MERGE_BUTTON);
  if (!merge) return { merge, tiles: tiles.byArmy };
  browser.tap(merge.offset);
  const confirm = await readUntil(
    () => browser.read(MERGE_BUTTON),
    (shown) => shown && shown.name !== merge.name,
    SHEET_WAIT_MS,
  );
  if (confirm && confirm.name !== merge.name) browser.tap(confirm.offset);
  return { merge, confirm, tiles: tiles.byArmy };
}

/**
 * The open sheet's button whose text or label matches `pattern` (a regular expression, any case): its name and where it
 * is, scrolled into the sheet's view as a player scrolls to it (a phone's sheet runs past its screen). A button that
 * shows only a figure is named by its label ("Refill 73").
 */
const sheetButton = (pattern, within = "[data-kit-sheet]") => `JSON.stringify((() => {
  const matches = (text) => new RegExp(${JSON.stringify(pattern)}, "i").test(text ?? "");
  const button = [...document.querySelectorAll(${JSON.stringify(`${within} button`)})]
    .find((candidate) => matches(candidate.textContent.trim()) || matches(candidate.getAttribute("aria-label")));
  if (!button) return null;
  button.scrollIntoView({ block: "nearest" });
  const rect = button.getBoundingClientRect();
  return {
    name: button.textContent.trim(),
    offset: [Math.round(rect.left + rect.width / 2 - innerWidth / 2), Math.round(rect.top + rect.height / 2 - innerHeight / 2)],
    region: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
    row: (({ left, top, width, height }) => ({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) }))(button.parentElement.getBoundingClientRect()),
  };
})())`;

const MERGE_BUTTON = sheetButton("merge into");

/**
 * Troops moved from one of the realm's armies to the other beside it (the lab's merge game): the spire's army picked,
 * the other right-clicked for the transfer card, then 500 typed as the troops it sends and Move pressed; the result is
 * both armies' tokens showing exactly the counts the chain answered.
 */
function transferActionSteps() {
  const tiles = { byArmy: null };
  return [
    { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
    { name: "pick-army", play: pickTheSpireArmy, settleMs: 0, verify: spireArmyPicked },
    { name: "open-transfer", play: (context) => openTheMerge(context, tiles), settleMs: 0, verify: mergeCardOpen },
    clickToResultStep(
      "transfer",
      "ManageTroops",
      (context) => sendSomeTroops(context, tiles),
      ({ played }) => played.watching && { watch: "transferred" },
    ),
  ];
}

const TROOPS_SENT = 500;
const TRANSFER_AMOUNT = '[data-kit-sheet] input[aria-label^="Troops "]';

/** Types the troops sent, then presses the card's Move where it is drawn, watching both armies' counts. */
async function sendSomeTroops({ browser }, tiles) {
  browser.run(["fill", TRANSFER_AMOUNT, String(TROOPS_SENT)]);
  const move = await readUntil(() => browser.read(sheetButton("^Move ")), Boolean, SHEET_WAIT_MS);
  if (!move) return { move };
  const tokens = Object.keys(tiles.byArmy ?? {}).map((army) => browser.read(armyToken(army))?.region);
  if (tokens.length !== 2 || !tokens.every(Boolean)) return { move: move.name, tokens };
  watchFor(browser, "transferred", tokensShowTheChainsCounts("ManageTroops"));
  browser.tap(move.offset);
  return { move: move.name, watching: true, region: boxAround(tokens) };
}

/** The smallest box holding every region given. */
const boxAround = (regions) => {
  const left = Math.min(...regions.map((region) => region.left));
  const top = Math.min(...regions.map((region) => region.top));
  const right = Math.max(...regions.map((region) => region.left + region.width));
  const bottom = Math.max(...regions.map((region) => region.top + region.height));
  return { left, top, width: right - left, height: bottom - top };
};

/**
 * A new army deployed (the lab's actions game): the dock's Deploy slot, the sheet's Max, then its Deploy; the result is
 * the army the chain created drawn on the map, beside the realm.
 */
const DEPLOY_ACTION_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  clickToResultStep("deploy", "CreateExplorer", deployFromTheDock, armyDeployed),
];

async function deployFromTheDock({ browser }, amount) {
  const before = Object.keys(browser.read(ARMY_TILES));
  browser.click("Deploy");
  const sheet = await readUntil(
    () => browser.read(SHEET_NAME),
    (name) => name === "Deploy",
    SHEET_WAIT_MS,
  );
  if (sheet !== "Deploy") return { sheet };
  if (amount === undefined) browser.click("Max");
  else browser.run(["fill", '[data-kit-sheet] input[aria-label="Troops"]', String(amount)]);
  const deploy = await readUntil(() => browser.read(sheetButton("^Deploy$")), Boolean, SHEET_WAIT_MS);
  if (!deploy) return { sheet, deploy };
  browser.tap(deploy.offset);
  const locate = () => {
    const arrived = Object.entries(browser.read(ARMY_TILES)).find(([army]) => !before.includes(army));
    return arrived ? armyRegion(arrived[1]) : null;
  };
  return { sheet, before, locate };
}

/** The army the lab's chain created for the step's CreateExplorer, drawn on the map. */
function armyDeployed({ actionLatency }) {
  const army = (actionLatency.chainAnswers ?? [])
    .filter(({ kind }) => kind === "CreateExplorer")
    .at(-1)
    ?.answered.find(({ model, value }) => model === "ExplorerTroops" && value !== null)?.value.explorer_id;
  return army && { presented: `army-shown:${army}` };
}

/**
 * A season's entry (the lab's settle game, which opens on the home page): the Frontier card's Play, the doorway settling
 * the player's realm, then the game opening on it, on that realm. The wait covers the game's boot after the chain has
 * answered.
 */
const ASPECT_SETTLE_STEPS = [
  {
    name: "found-in-chosen-aspect",
    play: async ({ browser, owner, extraScreenshot }) => {
      await playFromTheHomeCard({ browser, owner });
      await waitUntil(
        () => browser.read('document.querySelectorAll(".aspect-picker__card:not(:disabled)").length') === 4,
        PLAYABLE_WAIT_MS,
      );
      const choice = browser.read(`JSON.stringify({
        cards: [...document.querySelectorAll(".aspect-picker__card")].map(card => card.getAttribute("aria-label")),
        sent: (window.__labChain?.sent ?? []).filter(({command}) => command.kind === "SettleSeason").length,
      })`);
      const choosing = extraScreenshot("aspect-choice");
      if (choice.sent !== 0 || choice.cards.length !== 4) return { choice, choosing };
      browser.click("Join Chaos");
      await waitFor(browser, (seen) => seen.playable && seen.scene === "hex", PLAYABLE_WAIT_MS);
      const founded = browser.read(`JSON.stringify(
        (window.__labChain?.sent ?? []).filter(({command}) => command.kind === "SettleSeason")
      )`);
      return { choice, choosing, founded };
    },
    settleMs: 0,
    verify: ({ played, seen }) => {
      const [founded] = played.founded ?? [];
      const home = founded?.answered.find(({ model }) => model === "HomeAspect")?.value;
      const members = founded?.answered.find(({ model }) => model === "AspectMembers")?.value;
      return played.choice?.sent === 0 &&
        played.choice.cards?.length === 4 &&
        played.choice.cards.includes("Join Chaos") &&
        played.founded?.length === 1 &&
        founded.command.calldata.slice(5).map(Number).join(",") === "1,0,3" &&
        Number(home?.home) === 7 &&
        Number(home?.aspect) === 3 &&
        Number(members?.aspect) === 3 &&
        Number(members?.members) === 1 &&
        seen.playable &&
        isIn(seen, "Realm", "hex")
        ? completed(played)
        : failed("The chosen Aspect must be submitted and become the home's membership", played);
    },
  },
];

const SETTLE_ACTION_STEPS = [
  clickToResultStep("settle", "SettleSeason", playFromTheHomeCard, enteredOnTheRealm, { settleMs: SETTLE_RESULT_MS }),
];

/**
 * The map on the realm, as the player sees it once the doorway goes (the map is drawn under the doorway first, where
 * the player cannot see it). The target is the screen's lower third, below the doorway's plate and steps, where the
 * doorway shows only its painting and the map replaces it: its grey past half the way from the painting's at the mark.
 * A box on the realm would not do, as the doorway's steps light up over it before the mark.
 */
function enteredOnTheRealm({ played }) {
  const third = Math.floor(VIEWPORT.height / 3);
  return (
    played.entry && {
      presented: "entered",
      target: { left: 0, top: VIEWPORT.height - third, width: VIEWPORT.width, height: third },
    }
  );
}

async function playFromTheHomeCard({ browser, owner }) {
  const entry = await findHomeCardEntry(browser, owner, SHEET_WAIT_MS * 6, { card: LAB_SETTLE.card, game: LAB_SETTLE });
  browser.run(["click", ENTRY_BUTTON]);
  return { entry: entry.entry };
}

/**
 * A research bought (the lab's research game): Research opened, the Shrine's node picked, then its Research; the result
 * is that node showing the Shrine researched once the chain has answered it learned.
 */
const RESEARCH_ACTION_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  clickToResultStep(
    "research",
    "Research",
    researchTheShrine,
    ({ played }) => played.watching && { watch: "researched" },
  ),
];

const SHRINE_NODE = '[data-node="shrine"]';

async function researchTheShrine({ browser }) {
  browser.click("Research");
  const node = await readUntil(() => browser.read(elementAt(SHRINE_NODE)), Boolean, SHEET_WAIT_MS);
  if (!node || node.state !== "ready") return { node };
  browser.tap(node.offset);
  const research = await readUntil(() => browser.read(buttonNamed("Research Shrine")), Boolean, SHEET_WAIT_MS);
  if (!research) return { node, research };
  watchFor(browser, "researched", shrineResearched);
  browser.tap(research.offset);
  return { node: node.state, watching: true, region: node.region };
}

/** The Shrine's node reads Researched, and the lab's chain has answered its Research with the Shrine learned. */
const shrineResearched = `(() => {
  const answer = (window.__labChain?.sent ?? []).filter(({ command }) => command.kind === "Research").at(-1);
  const learned = answer?.answered.find(({ model }) => model === "RealmKnowledge")?.value.learned;
  return learned !== undefined && ((BigInt(learned) >> 44n) & 1n) === 1n &&
    document.querySelector(${JSON.stringify(SHRINE_NODE)})?.dataset.state === "done";
})()`;

/** An element's box, where it is from the screen's centre, and its state; null while it is not drawn. */
const elementAt = (selector) => `JSON.stringify((() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    state: element.dataset.state ?? null,
    region: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
    offset: [Math.round(rect.left + rect.width / 2 - innerWidth / 2), Math.round(rect.top + rect.height / 2 - innerHeight / 2)],
  };
})())`;

/** A button by its whole text, where it is from the screen's centre; null while none is drawn. */
const buttonNamed = (name) => `JSON.stringify((() => {
  const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent.trim() === ${JSON.stringify(name)});
  if (!button) return null;
  const rect = button.getBoundingClientRect();
  return { offset: [Math.round(rect.left + rect.width / 2 - innerWidth / 2), Math.round(rect.top + rect.height / 2 - innerHeight / 2)] };
})())`;

/**
 * A Realm's labor claimed (the lab's claim game, whose relay the tab answers): Realms opened (a desktop's purse, a
 * phone's Menu), then its daily Claim; the result is the sheet saying that Realm's labor was claimed today, once the
 * chain has granted it.
 */
const DAILY_QUEST_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  {
    name: "collect-daily-quest",
    play: async ({ browser, extraScreenshot }) => {
      const ready = await readUntil(
        () =>
          browser.read(`JSON.stringify((() => {
        const panel = document.querySelector('[data-daily-quest]');
        return { text: panel?.textContent, collect: [...(panel?.querySelectorAll('button') ?? [])].some(b => b.textContent === 'Collect' && !b.disabled) };
      })())`),
        (value) => value.collect,
        PLAYABLE_WAIT_MS,
      );
      const before = extraScreenshot("quest-ready");
      if (!ready?.collect) return { ready, before };
      browser.click("Collect");
      const collected = await readUntil(
        () => browser.read(`Boolean(document.querySelector('[data-daily-quest] [aria-label="Collected"]'))`),
        Boolean,
        PLAYABLE_WAIT_MS,
      );
      const grants = browser.read(
        `JSON.stringify((window.__labChain?.sent ?? []).filter(({command}) => command.kind === 'ClaimDailyQuest'))`,
      );
      return { ready, before, collected, grants };
    },
    settleMs: 0,
    verify: ({ played }) => {
      const [sent] = played.grants ?? [];
      const receipt = sent?.answered.find(({ model }) => model === "LaborGrant")?.value;
      const balances = sent?.answered.filter(({ model }) => model === "ResourceBalance") ?? [];
      return played.ready?.collect &&
        played.collected &&
        played.grants?.length === 1 &&
        Number(sent.command.fields.home) === 7 &&
        Number(sent.command.fields.day) === 0 &&
        Number(receipt?.home) === 7 &&
        Number(receipt?.day) === 0 &&
        receipt?.amount === "1000000000000" &&
        receipt?.essence === "1500000000000" &&
        balances.length === 2 &&
        balances.every(({ value }) => value.balance === "1500000000000")
        ? completed(played)
        : failed("Collect must send the exact home/day and display its confirmed reward receipt", played);
    },
  },
];

const CLAIM_ACTION_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  clickToResultStep("claim", "GrantLabor", claimARealmsLabor, ({ played }) => played.watching && { watch: "claimed" }),
];

const REALMS_SHEET = `[data-kit-sheet][aria-label="${HUD_WORDS.realmLabor}"]`;

async function openRealmLabor(browser) {
  if (browser.read(SHEET_NAME) === HUD_WORDS.realmLabor) return HUD_WORDS.realmLabor;
  // A desktop's purse chip opens Realm Labor (its name goes on with what waits); a phone's Menu holds it.
  if (onADesktop()) {
    const chip = await readUntil(
      () => browser.read(buttonLabelled(`^${HUD_WORDS.realmLabor}`)),
      Boolean,
      SHEET_WAIT_MS,
    );
    if (!chip) return { chip };
    browser.tap(chip.offset);
  } else {
    browser.click(HUD_WORDS.menu);
    await readUntil(() => browser.read(buttonNamed(HUD_WORDS.realmLabor)), Boolean, SHEET_WAIT_MS);
    browser.click(HUD_WORDS.realmLabor);
  }
  const sheet = await readUntil(
    () => browser.read(SHEET_NAME),
    (name) => name === HUD_WORDS.realmLabor,
    SHEET_WAIT_MS,
  );
  return sheet;
}

async function claimARealmsLabor({ browser }) {
  const sheet = await openRealmLabor(browser);
  if (sheet !== HUD_WORDS.realmLabor) return { sheet };
  const claim = await readUntil(() => browser.read(sheetButton("^Claim [0-9,]+ Labor")), Boolean, SHEET_WAIT_MS);
  if (!claim) return { sheet, claim };
  const region = browser.read(sheetRegion(REALMS_SHEET));
  watchFor(browser, "claimed", realmClaimed);
  browser.tap(claim.offset);
  return { sheet, watching: true, region };
}

/** The lab chain granted the Realm's labor, and the Realm Labor sheet's strip shows today claimed. */
const realmClaimed = `(() => {
  const grant = (window.__labChain?.sent ?? []).filter(({ command }) => command.kind === "GrantLabor").at(-1)
    ?.answered.find(({ model }) => model === "LaborGrant");
  const today = document.querySelector(${JSON.stringify(REALMS_SHEET)})?.querySelector('[aria-current="date"]');
  return String(grant?.value.home) === "7" && today?.getAttribute("data-state") === "claimed";
})()`;

/** Open an army's panel, spend a Battle skill point, and read the tier the command changed. */
const ARMY_ACTION_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  clickToResultStep(
    "tier",
    "SpendSkillPoint",
    levelUpTheArmy,
    ({ played }) => played.watching && { watch: "tier-bought" },
  ),
];

async function openTheArmyPanel(browser) {
  const open = browser.read(SHEET_NAME);
  if (/^Army \d+$/.test(open ?? "")) {
    return { army: open, sheet: open, region: browser.read(sheetRegion(`[data-kit-sheet][aria-label="${open}"]`)) };
  }
  const army = await focusTheArmyFromItsDock(browser);
  if (!army) return { army };
  if (browser.read(SHEET_NAME) !== army) {
    const details = browser.read(buttonLabelled(`^${army}(: details)?$`));
    if (details) browser.tap(details.offset);
  }
  const sheet = await readUntil(
    () => browser.read(SHEET_NAME),
    (name) => name === army,
    SHEET_WAIT_MS,
  );
  return {
    army,
    sheet,
    region: sheet === army ? browser.read(sheetRegion(`[data-kit-sheet][aria-label="${army}"]`)) : null,
  };
}

async function levelUpTheArmy({ browser }) {
  const panel = await openTheArmyPanel(browser);
  if (panel.sheet !== panel.army) return panel;
  const choose = browser.read(sheetButton("^Level up$"));
  if (!choose) return { ...panel, choose };
  browser.tap(choose.offset);
  const battle = await readUntil(() => browser.read(sheetButton("^Battle")), Boolean, SHEET_WAIT_MS);
  if (!battle) return { ...panel, battle };
  const buy = browser.read(sheetButton("^Level up$"));
  if (!buy) return { ...panel, buy };
  watchFor(browser, "tier-bought", panelShowsTheChainsTier(panel.army));
  browser.tap(buy.offset);
  return { ...panel, watching: true };
}

/**
 * The army's panel shows the Battle tier the lab's chain bought, back on its status: the point was its last, so the
 * choices have nothing left to buy and the panel returns to the army, its Battle tile at that tier.
 */
const panelShowsTheChainsTier = (army) => `(() => {
  const bought = (window.__labChain?.sent ?? []).filter(({ command }) => command.kind === "SpendSkillPoint").at(-1);
  const tier = bought?.answered.find(({ model }) => model === "ArmyProgress")?.value.battle;
  const sheet = document.querySelector('[data-kit-sheet][aria-label="${army}"]');
  return tier !== undefined &&
    sheet?.querySelector('[data-army-step="stats"] button[aria-label^="Battle "] .ui-tier[data-tier="' + tier + '"]') != null;
})()`;

/**
 * A building demolished (the lab's upkeep game): the realm, a first-ring building tapped for its card, Delete, then
 * Confirm delete; the result is the building the chain removed leaving its plot.
 */
const DEMOLISH_ACTION_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "open-realm", play: goTo("Realm", "hex"), settleMs: 3_000, verify: inScene("hex") },
  clickToResultStep("demolish", "DestroyBuilding", demolishABuilding, buildingDemolished),
];

async function demolishABuilding({ browser }) {
  browser.press("Escape");
  const tapped = [];
  for (const offset of FIRST_RING_CANDIDATES) {
    browser.tap(offset);
    const remove = await readUntil(() => browser.read(sheetButton("^Delete$")), Boolean, SHEET_WAIT_MS);
    tapped.push({ offset, sheet: browser.read(SHEET_NAME) });
    if (remove) {
      browser.tap(remove.offset);
      const confirm = await readUntil(() => browser.read(sheetButton("^Confirm delete$")), Boolean, SHEET_WAIT_MS);
      if (!confirm) return { tapped, confirm };
      browser.tap(confirm.offset);
      return { tapped, plot: offset, region: tileRegion(offset) };
    }
    if (browser.read(SHEET_NAME) !== null) browser.press("Escape");
  }
  return { tapped };
}

// The first ring round the castle, from its top-left clockwise, where a Settlement's buildings stand: as a desktop
// draws it, then as a phone's narrower view does.
const FIRST_RING = [
  [-80, -120],
  [75, -120],
  [160, -5],
  [90, 110],
  [-90, 110],
  [-170, -20],
];
const FIRST_RING_CANDIDATES = [
  ...FIRST_RING,
  ...FIRST_RING.map(([dx, dy]) => [Math.round(dx * 0.6), Math.round(dy * 0.6)]),
];

/**
 * The building the lab's chain removed for the step's DestroyBuilding, leaving its plot. Its screen proof is open: the
 * plot changes again after it (the Build sheet's highlight, then its chosen building's ghost), and the proof reads the
 * plot's last look, so a capture run fails it.
 */
function buildingDemolished({ actionLatency }) {
  const removed = (actionLatency.chainAnswers ?? [])
    .filter(({ kind }) => kind === "DestroyBuilding")
    .at(-1)
    ?.answered.find(({ model, value }) => model === "Building" && value === null);
  const [, , col, row] = removed?.key.split(":") ?? [];
  return col && { presented: `building-gone:${col},${row}` };
}

/**
 * A chest opened (the lab's upkeep game): the army selected, the tile beside it that holds a chest opened as a player
 * does (a desktop's right-click on the tile whose hover offers Open crate; a phone's tap, then its card's Open); the
 * result is that chest consumed off its tile.
 */
const HEX_ON_SCREEN = `JSON.stringify(window.__eternumMapSelection?.hexOnScreen ?? null)`;

/** The selected hex's place once the camera has stopped framing it: two readings a frame apart that agree. */
async function settledHexOnScreen(browser) {
  let previous = null;
  for (let reads = 0; reads < 20; reads += 1) {
    const at = browser.read(HEX_ON_SCREEN);
    if (at && previous && Math.abs(at.x - previous.x) < 1 && Math.abs(at.y - previous.y) < 1) return at;
    previous = at;
    await sleep(100);
  }
  return null;
}

const screenPoint = ([dx, dy]) => ({ x: VIEWPORT.width / 2 + dx, y: VIEWPORT.height / 2 + dy });

/** A chest's body on its tile (page px): what its lid lifting changes, not the tile round it. */
const chestBody = ({ x, y }) => ({ left: Math.round(x - 25), top: Math.round(y - 35), width: 50, height: 40 });

/** A button on the page whose label (or text) matches `pattern`: its name and where it is from the screen's centre. */
const buttonLabelled = (pattern) => `JSON.stringify((() => {
  const button = [...document.querySelectorAll("button")]
    .find((candidate) => new RegExp(${JSON.stringify(pattern)}).test(candidate.getAttribute("aria-label") ?? candidate.textContent.trim()));
  if (!button) return null;
  const rect = button.getBoundingClientRect();
  return {
    name: button.getAttribute("aria-label") ?? button.textContent.trim(),
    offset: [Math.round(rect.left + rect.width / 2 - innerWidth / 2), Math.round(rect.top + rect.height / 2 - innerHeight / 2)],
    region: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
  };
})())`;

/** A button in the sheet `selector` names, whose text matches `pattern`: its name and where it is. */
const buttonIn = (selector, pattern) => `JSON.stringify((() => {
  const button = [...(document.querySelector(${JSON.stringify(selector)})?.querySelectorAll("button") ?? [])]
    .find((candidate) => new RegExp(${JSON.stringify(pattern)}).test(candidate.textContent.trim()));
  if (!button) return null;
  const rect = button.getBoundingClientRect();
  return { name: button.textContent.trim(), offset: [Math.round(rect.left + rect.width / 2 - innerWidth / 2), Math.round(rect.top + rect.height / 2 - innerHeight / 2)] };
})())`;

/** The army the lab's chain removed in the merge, leaving the map from its tile. */
const mergedAway = ({ played, actionLatency }) => {
  const removed = (actionLatency.chainAnswers ?? [])
    .filter(({ kind }) => kind === "ManageTroops")
    .at(-1)
    ?.answered.find(({ model, value }) => model === "ExplorerTroops" && value === null);
  const army = removed?.key.split(":").at(-1);
  const tile = army && played.tiles?.[army];
  return tile && { presented: `army-gone:${army}`, region: tileRegion(tile) };
};

const sheetRegion = (selector) => `JSON.stringify((() => {
  const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
  return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
})())`;

const REALM_LEVELS = ["Settlement", "City", "Kingdom", "Empire"];
const CASTLE_SHEET_TEXT = `document.querySelector('[data-kit-sheet][aria-label="Castle"]')?.textContent ?? ""`;
const SHEET_NAME = `JSON.stringify(document.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null)`;
const SHEET_WAIT_MS = 3_000;

/**
 * Taps the keep at the realm's centre for its Castle sheet, which names the level now and the next, then presses
 * Upgrade, watching for the sheet to name exactly the next level as its own and the one after as its next.
 */
async function raiseTheCastle({ browser }) {
  browser.tap([0, 0]);
  const sheet = await readUntil(
    () => browser.read(SHEET_NAME),
    (name) => name === "Castle",
    SHEET_WAIT_MS,
  );
  if (sheet !== "Castle") return { sheet };
  const shown = browser.read(`JSON.stringify(${CASTLE_SHEET_TEXT})`);
  const level = REALM_LEVELS.findIndex((word) => shown.includes(word));
  const raisedTo = REALM_LEVELS[level + 1];
  if (level === -1 || !raisedTo) return { sheet, level: REALM_LEVELS[level] ?? null };
  const after = REALM_LEVELS[level + 2];
  const nowRaised = [
    `!text.includes(${JSON.stringify(REALM_LEVELS[level])})`,
    `text.includes(${JSON.stringify(raisedTo)})`,
    ...(after ? [`text.includes(${JSON.stringify(after)})`] : []),
  ].join(" && ");
  watchFor(browser, "level-up", `((text) => text !== "" && ${nowRaised})(${CASTLE_SHEET_TEXT})`);
  const region = browser.read(SHEET_REGION);
  browser.click("Upgrade");
  return { sheet, level: REALM_LEVELS[level], raisedTo, region };
}

const SHEET_REGION = sheetRegion('[data-kit-sheet][aria-label="Castle"]');

/**
 * Taps down towards the castle from above, a plot at a time, until one opens the Build sheet (straight above the castle
 * the outermost open plot is the second ring's, nearer on a phone than on a desktop), then presses Build for the sheet's
 * requested building, or its first offer.
 */
async function buildOnAnOpenPlot({ browser }, building) {
  browser.press("Escape");
  const tapped = [];
  for (const offset of PLOT_CANDIDATES) {
    browser.tap(offset);
    const sheet = await readUntil(
      () => browser.read(SHEET_NAME),
      (name) => name !== null,
      SHEET_WAIT_MS,
    );
    tapped.push({ offset, sheet });
    if (sheet === "Build") {
      if (building) {
        const choice = browser.read(sheetButton(`^${building}`));
        if (!choice) throw new Error(`No ${building} in the Build sheet`);
        browser.tap(choice.offset);
      }
      browser.click("Build");
      return { tapped, plot: offset, region: tileRegion(offset) };
    }
    if (sheet !== null) browser.press("Escape");
  }
  return { tapped };
}

const PLOT_CANDIDATES = [...[-230, -210, -190, -170, -150, -130].map((dy) => [0, dy]), [-60, -90], [60, -90]];

/** Has the probe report the first frame `expression` holds in, under `name`. */
function watchFor(browser, name, expression) {
  browser.run(["eval", `window.__playtest.watch(${JSON.stringify(name)}, ${JSON.stringify(expression)})`]);
}

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
  [place, PLACE_TABS[place], place === "Map" && ETHEREAL].some((name) => Boolean(name && seen.place?.startsWith(name)));

/** A desktop's World tab names the Ethereal layer the map shows, once the realm has one: the map still. */
const ETHEREAL = "Ethereal";

/**
 * A place as the top bar's Realm / World names it: a desktop's HUD, every mode's, moves between the map and the realm
 * there; a phone's Frontier HUD has its place bar's switch, which names where it goes: Realm on the map, World on the
 * realm (the page reads where the player is from it).
 */
const PLACE_TABS = { Map: "World", Realm: "Realm" };

/**
 * Presses the place bar's switch where there is one (a phone, as it names the place), else the top bar's tab (a
 * desktop). For a realm with an Ethereal layer, the switch or the World tab opens the list of views instead, on the map
 * and in the realm alike: the place is then chosen from that list.
 */
function pressPlace(browser, place) {
  const presses = [
    () => browser.click(place),
    () => browser.click(PLACE_TABS[place]),
    () => browser.clickTab(PLACE_TABS[place]),
  ];
  for (const press of presses) {
    try {
      press();
      if (browser.viewChoices().length > 0) browser.chooseView(PLACE_TABS[place]);
      return;
    } catch {
      // Not this button: the next way there.
    }
  }
  browser.chooseView(PLACE_TABS[place]);
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
 * The season's board as a player reads it: a desktop's Season place opens it in the rail and a second press closes it;
 * a phone opens it from the Menu and closes it with the board's ×, as a phone has no Escape key.
 */
async function readTheSeason(input) {
  if (!onADesktop()) return { desktop: false, ...(await readTheSeasonInTheMenu(input)) };
  const { browser } = input;
  browser.click(HUD_WORDS.season);
  await sleep(2_000);
  const opened = browser.observe();
  browser.click(HUD_WORDS.season);
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
 * presses it: the map goes where it happened. A desktop's Feed stands in the rail. A phone's stories are in its Feed: the
 * player taps Feed in the place bar, then the story. A story whose army can be selected puts the Feed away for its card;
 * one that only goes to a place leaves the Feed open over the map, and the player taps Feed again to look at the place
 * (the place bar's Map would take the camera home). Frontier's realms stand millions of hexes apart, so a story of
 * another realm is a far jump.
 */
async function openAFeedEvent({ browser }) {
  const before = browser.observe();
  const from = browser.read(ROUTE_HEX_EXPRESSION);
  const feed = onADesktop() ? undefined : await tapTheFeed(browser);
  if (feed === false) return { feed, row: null };
  // A row's button is named by its words, time and line run together; the browser presses the first one where it is.
  const row = browser.read(`JSON.stringify(document.querySelector(".ui-event__open")?.textContent.trim() ?? null)`);
  if (!row) return { feed, row: null };
  browser.run(["click", ".ui-event__open"]);
  await waitFor(browser, (seen) => seen.playable && seen.scene === "map", SCENE_WAIT_MS);
  const to = browser.read(ROUTE_HEX_EXPRESSION);
  const feedLeftOpen = feed
    ? !(await waitFor(browser, (seen) => !seen.panels.includes(HUD_WORDS.feed), FEED_CLOSES_MS))
    : undefined;
  if (feedLeftOpen) await tapTheFeed(browser);
  return {
    feed,
    row,
    from,
    to,
    apart: hexesApart(from, to),
    feedLeftOpen,
    reloaded: browser.observe().timeOrigin !== before.timeOrigin,
  };
}

/** How long an army's card takes to stand in the Feed's place once its story is tapped. */
const FEED_CLOSES_MS = 3_000;

/** A phone's Feed slot tapped, as a player taps it; whether the Feed's panel is drawn after. */
async function tapTheFeed(browser) {
  browser.tapPlace(HUD_WORDS.feed);
  await sleep(1_500);
  return browser.observe().panels.includes(HUD_WORDS.feed);
}

/**
 * A story opens in the page, never by loading it again, on the map at the story's place, with what is there selected:
 * the selected tile (a contract hex) is the route's (a normalized hex), one map centre apart on both axes.
 */
function openedInThePage({ seen, played }) {
  if (played.feed === false) return failed(`the ${HUD_WORDS.feed} did not open`, played);
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
  const row = await visitFromTheBoard(browser, index);
  if (!row) return { row: null };
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

/** The Season's board row at `index` opened and Visit pressed, as a player does; null when the board has no such row. */
async function visitFromTheBoard(browser, index) {
  if (onADesktop()) browser.click(HUD_WORDS.season);
  else {
    browser.click(HUD_WORDS.menu);
    await sleep(1_500);
    browser.click(HUD_WORDS.season);
  }
  await sleep(2_000);
  const rows = `[...document.querySelectorAll('button[aria-label^="#"]')].map((row) => row.getAttribute("aria-label"))`;
  const row = browser.read(`JSON.stringify(${rows})`)[index] ?? null;
  if (!row) return null;
  browser.click(row);
  await sleep(1_500);
  browser.click("Visit");
  return row;
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

/**
 * The Season's board drew and then closed, wherever the HUD puts it: on a desktop with its place lit, on a phone from an
 * opened Menu.
 */
function seasonReadAndClosed({ played }) {
  if (played.desktop && !played.opened.pressed.includes(HUD_WORDS.season))
    return failed("the Season place was not lit", played);
  if (!played.desktop && !played.menu.includes(HUD_WORDS.menu))
    return failed(`the ${HUD_WORDS.menu} did not open`, played);
  if (!played.opened.panels.includes(HUD_WORDS.season)) return failed("the Season's board was not drawn", played);
  if (played.closed.panels.includes(HUD_WORDS.season)) return failed("the Season's board did not close", played);
  return completed(played);
}

async function readTheSeasonInTheMenu({ browser }) {
  browser.click(HUD_WORDS.menu);
  await sleep(1_500);
  // The Menu is a page of the place bar, drawn as a panel over the map.
  const menu = browser.observe().panels;
  browser.click(HUD_WORDS.season);
  await sleep(2_000);
  const opened = browser.observe();
  browser.click(HUD_WORDS.close);
  await sleep(1_000);
  return { menu, opened, closed: browser.observe() };
}

/** A Wheat ring or phone plate opens its store card; pressing it again closes the same card. */
/**
 * The Wheat store's card opened from its ring (a desktop's realm panel) or its plate (a phone's strip), then closed by
 * the same press: both found by the store they stand for (`data-store`, `data-store-card`), not by words a label may
 * change.
 */
async function openAndCloseWheatStore({ browser }) {
  const card = () => browser.read(`Boolean(document.querySelector('[data-store-card="wheat"]'))`);
  browser.run(["click", '[data-store="wheat"]']);
  await sleep(1_500);
  const opened = card();
  browser.run(["click", '[data-store="wheat"]']);
  await sleep(1_000);
  return { opened, closed: card() };
}

function storeOpenedAndClosed({ played }) {
  if (!played.opened) return failed("the Wheat store card did not open");
  if (played.closed) return failed("the Wheat store card did not close");
  return completed(played);
}

/** The army with the most stamina, as a player picks the one that can act; selecting it centres the camera on it. */
async function selectTheReadiestArmy({ browser }) {
  const armies = browser.armies();
  return { armies, army: await focusTheReadiestArmy(browser, armies) };
}

/** Selects the army with the most stamina from the dock (a desktop's pick centres it; a phone's may not). */
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

/** The army pressed is the one the map reports selected: a phone's dock names its button otherwise ("Army 1: details"). */
function armySelected({ seen, played }) {
  if (!played.army) return blocked("the player has no army on the HUD");
  const selected = seen.selection?.army ?? null;
  return selected
    ? completed({ army: played.army, selected, armies: played.armies })
    : failed(`${played.army} was pressed and the map reports no army selected`);
}

/**
 * Centres the army and explores a tile beside it as a player does: on a desktop, hovers its neighbours until one's
 * tooltip offers Explore and right-clicks it (the map's own order, as in Blitz); on a phone, taps them until one's order
 * bar names Explore and taps that tile again, which sends it, other offers cancelled.
 */
function exploreBesideArmy(context) {
  return orderBesideArmy(context, "Explore");
}

/**
 * Selects the readiest army from the dock. A phone keeps an army selected after its order, its panel where the dock
 * was: the panel is put away first, as a player does to pick an army again.
 */
async function focusTheArmyFromItsDock(browser) {
  if (browser.armies().length === 0 && browser.observe().selection?.army) {
    browser.press("Escape");
    await waitFor(browser, () => browser.armies().length > 0, BURST_SELECT_WAIT_MS);
  }
  return focusTheReadiestArmy(browser);
}

/**
 * Gives the readiest army the order `verb` (Explore, Move) on a tile beside it, aimed from where the army stands on
 * screen (its token; the camera is left where it is: picking an army does not always centre it), and names the region
 * its result shows in: the explored tile, or the army's figure, which a move sets off.
 */
async function orderBesideArmy({ browser, extraScreenshot }, verb) {
  const armyName = await focusTheArmyFromItsDock(browser);
  if (!armyName) return { offered: [], army: armyName };
  const selection = browser.observe().selection;
  const armyId = selection?.army?.id ?? null;
  const armyAt = armyOnScreen(browser, armyId);
  if (!armyAt)
    return { army: armyName, armyId, offered: [], aimed: "the army is not within reach of the view's centre" };
  const regionOf = (target) => (verb === "Explore" ? tileRegion(target) : armyRegion(armyAt));
  if (onADesktop()) {
    const { target, scanned } = await findOrderTile(browser, [verb], armyAt);
    const offered = scanned.map((seen) => seen.verb);
    if (!target) return { army: armyName, armyId, armyAt, offered };
    const before = extraScreenshot("before");
    const pressedAt = browser.observe().now;
    browser.rightClick(target.offset);
    return {
      army: armyName,
      armyId,
      armyAt,
      offered,
      pressedAt,
      before,
      target: target.offset,
      region: regionOf(target.offset),
    };
  }
  const offered = [];
  const offMap = [];
  const taps = [];
  // The army's paths are planned once it is selected; a pass where no tile pins anything is tried once more.
  for (let pass = 1; pass <= TAP_PASSES; pass += 1) {
    for (const step of NEIGHBOUR_RING) {
      // A pinned order may frame its tile above its card: the army is found again before each tap.
      const army = armyOnScreen(browser, armyId) ?? armyAt;
      const at = [army[0] + step[0], army[1] + step[1]];
      if (!onTheOpenMap(at)) {
        offMap.push(at);
        continue;
      }
      const pinnedAt = browser.observe().now;
      browser.tap(at);
      const offer = orderVerb(browser.orderBar());
      offered.push(offer);
      const selection = browser.observe().selection;
      taps.push({ at, offer, camera: selection?.camera ?? null, armySelected: Boolean(selection?.army) });
      // A tile holding something else (a structure, the spire) takes the selection: pick the army again.
      if (offer !== verb && !selection?.army) await focusTheArmyFromItsDock(browser);
      if (offer === verb) {
        const before = extraScreenshot("before");
        const pressedAt = browser.observe().now;
        // The phone's own confirmation (owner, 27 October 2026: "double tapping to explore on mobile"): the same tile again.
        browser.tap(at);
        return {
          army: armyName,
          armyId,
          armyAt: army,
          offered,
          pinnedAt,
          pressedAt,
          before,
          target: at,
          region: verb === "Explore" ? tileRegion(at) : armyRegion(army),
          taps,
        };
      }
    }
    if (offered.some(Boolean)) break;
    await sleep(ARMY_FLIGHT_MS);
  }
  browser.press("Escape");
  return { army: armyName, armyId, armyAt, offered, offMap, taps };
}

/** A phone's open map, between its top bars and its dock: a tap outside it lands on the HUD or off the page. */
const OPEN_MAP_MARGINS = { side: 30, top: 140, bottom: 260 };
const onTheOpenMap = ([dx, dy]) =>
  Math.abs(dx) <= VIEWPORT.width / 2 - OPEN_MAP_MARGINS.side &&
  dy >= OPEN_MAP_MARGINS.top - VIEWPORT.height / 2 &&
  dy <= VIEWPORT.height / 2 - OPEN_MAP_MARGINS.bottom;

/**
 * Where an army stands on screen, from the view's centre: its token, as the map places it over the army, lowered to its
 * tile (TOKEN_ABOVE_TILE_PX at the map's default zoom); null when its token is not drawn.
 */
function armyOnScreen(browser, army) {
  return army === undefined || army === null ? null : (browser.read(ARMY_TILES)[String(army)] ?? null);
}

/**
 * The client's record of the explore, the screen around the explored tile before Enter against after settling, and the
 * army's plate read while it settled.
 */
async function explored({ played, actionLatency, screenshot, probe }) {
  const tileChange = played.before ? await meanViewChange(played.before, screenshot, tileRegion(played.target)) : null;
  return judgeExplore({ ...played, tileChange, plateStamina: probe.plateStamina }, actionLatency.clientActions);
}

/**
 * The army's figure standing on its tile at `offset` from the screen centre, at the map's default zoom: where its walk
 * shows first. Its tile's own highlights (the orders lit round it, the selected outline) fall outside it, and they
 * change when the selection does, not when the army moves.
 */
function armyRegion([dx, dy]) {
  return { left: VIEWPORT.width / 2 + dx - 25, top: VIEWPORT.height / 2 + dy - 60, width: 50, height: 60 };
}

/** A 120×100 patch centred on a tile tapped at `offset` from the screen centre. */
function tileRegion([dx, dy]) {
  return { left: VIEWPORT.width / 2 + dx - 60, top: VIEWPORT.height / 2 + dy - 50, width: 120, height: 100 };
}

/** A tile's box (page px) round the point the map draws it at. */
const tileRegionAt = ({ x, y }) => ({ left: Math.round(x - 60), top: Math.round(y - 50), width: 120, height: 100 });

/** A tile's ground inside its outline: what its terrain alone fills. */
function tileInterior([dx, dy]) {
  return { left: VIEWPORT.width / 2 + dx - 32, top: VIEWPORT.height / 2 + dy - 25, width: 64, height: 50 };
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
 * Hovers tiles around the army (standing `around` the view's centre) until one's tooltip offers it one of `verbs` (a
 * move or an explore), as a player reads it.
 */
async function findOrderTile(browser, verbs = ["Move", "Explore"], around = [0, 0]) {
  const scanned = [];
  for (const [dx, dy] of ORDER_TILE_CANDIDATES) {
    const offset = [around[0] + dx, around[1] + dy];
    browser.hover(offset);
    await sleep(HOVER_SETTLE_MS);
    const verb = browser.read(ORDER_TOOLTIP_TITLE);
    scanned.push({ offset, verb });
    if (verbs.includes(verb)) return { target: { offset, verb }, scanned };
  }
  return { target: null, scanned };
}

// The army's ring, then the ring past it: a moved army may stand a tile off the centre.
const ORDER_TILE_CANDIDATES = [...NEIGHBOUR_RING, ...NEIGHBOUR_RING.map(([dx, dy]) => [dx * 2, dy * 2])];

// The hover tooltip's title (Move, Explore, Attack…), its first line over a tile the selected army has an order on.
const ORDER_TOOLTIP_TITLE = `JSON.stringify(document.querySelector('[role="tooltip"][aria-hidden="false"] .ui-tip__line')?.textContent.trim() ?? null)`;

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
    assets: browser.read(
      'JSON.parse(window.__playtest.read()).resources.filter((entry) => entry.url.startsWith("/models/"))',
    ),
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
 * the view switched with the army into Ethereal II.
 */
const LAB_SPIRE_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "pick-army", play: pickTheSpireArmy, settleMs: 1_500, verify: spireArmyPicked },
  { name: "army-panel", play: readTheArmyPanel, settleMs: 0, verify: armyPanelOffersSpire },
  { name: "spire-card", play: pressSpire, settleMs: 0, verify: spireCardOffersDepths },
  { name: "enter-depth", play: enterEtherealII, settleMs: 0, verify: armyEnteredEtherealII },
];

/**
 * The map's share of the page on an odd device (owner, 4 November: "on some weird mobile devices with weird shapes the
 * map is like 15%"), on the lab's sites game: the map at rest, the army picked, its panel, a site's card beside it,
 * Chat and the Menu. Each step reads the share as a player sees it (MAP_SHARE_EXPRESSION) and which HUD part takes
 * the rest, and fails under MAP_LEAST_SHARE (Chat, which fills the band, excepted); a step that could not reach its
 * state is blocked, never read as the map's. Run it at each device's size with --viewport.
 */
const HUD_DEVICE_STEPS = [
  { name: "map", play: readTheMapShare, settleMs: 3_000, verify: mapShareRead },
  {
    name: "army",
    play: async (context) => ({ ...(await pickTheSpireArmy(context)), ...readTheMapShare(context) }),
    settleMs: 1_500,
    verify: (context) => (context.played.army ? mapShareRead(context) : blocked("no army picked", context.played)),
  },
  {
    name: "army-panel",
    play: async ({ browser }) => ({ panel: await openThePickedArmysPanel(browser), ...readTheMapShare({ browser }) }),
    settleMs: 0,
    verify: (context) => (context.played.panel ? mapShareRead(context) : blocked("no army panel", context.played)),
  },
  {
    name: "site-card",
    play: async ({ browser }) => ({ ...(await openASiteCard(browser)), ...readTheMapShare({ browser }) }),
    settleMs: 0,
    verify: (context) => (context.played.card ? mapShareRead(context) : blocked("no site card", context.played)),
  },
  {
    name: "chat",
    play: async ({ browser }) => {
      browser.press("Escape");
      await sleep(HOVER_SETTLE_MS);
      browser.tapPlace("Chat");
      await sleep(SHEET_WAIT_MS);
      return readTheMapShare({ browser });
    },
    settleMs: 0,
    verify: mapShareReadUnheld,
  },
  {
    name: "menu",
    play: async ({ browser }) => {
      browser.tapPlace("Menu");
      await sleep(SHEET_WAIT_MS);
      return readTheMapShare({ browser });
    },
    settleMs: 0,
    verify: mapShareRead,
  },
];

function readTheMapShare({ browser }) {
  return { share: browser.mapShare() };
}

/** The share read, and the map keeping at least MAP_LEAST_SHARE of the page. */
function mapShareRead({ played }) {
  if (!played.share?.canvas) return blocked("the map's canvas is not on the page", played);
  if (played.share.map < MAP_LEAST_SHARE)
    return failed(`the map shows ${played.share.map}% of the page, under ${MAP_LEAST_SHARE}%`, played);
  return completed(played);
}

/** Chat's share, read but not held to the least: Chat fills the band by the owner's call (3 November). */
function mapShareReadUnheld({ played }) {
  return played.share?.canvas ? completed(played) : blocked("the map's canvas is not on the page", played);
}

/** The picked army's panel: its sheet, opened by its own details button (a phone's picked army, a desktop's row). */
async function openThePickedArmysPanel(browser) {
  const open = browser.read(SHEET_NAME);
  if (/^Army \d+$/.test(open ?? "")) return open;
  const details = browser.read(buttonLabelled("^Army \\d+(: details)?$"));
  if (!details) return null;
  browser.tap(details.offset);
  return readUntil(
    () => browser.read(SHEET_NAME),
    (name) => /^Army \d+$/.test(name ?? ""),
    SHEET_WAIT_MS,
  );
}

/**
 * Taps the tiles round the picked army until one opens a map card (the sites game's Well or Shrine, else the card of
 * the tile tapped), re-picking the army between taps; the cards each tap opened are kept.
 */
async function openASiteCard(browser) {
  browser.press("Escape");
  const offered = [];
  for (const [dx, dy] of NEIGHBOUR_RING) {
    // A dock with no button for the army (folded under another surface) leaves the card unreached, never a failure.
    if (!browser.observe().selection?.army) await pickTheSpireArmy({ browser }).catch(() => null);
    const armyAt = armyOnScreen(browser, browser.observe().selection?.army?.id);
    if (!armyAt) return { card: null, offered };
    browser.tap([armyAt[0] + dx, armyAt[1] + dy]);
    const sheet = await readUntil(
      () => browser.read(SHEET_NAME),
      (name) => name !== null,
      SHEET_WAIT_MS,
    );
    offered.push(sheet);
    if (sheet !== null && !/^Army \d+$/.test(sheet)) return { card: sheet, offered };
    if (sheet !== null) browser.press("Escape");
  }
  return { card: null, offered };
}

/** Each proof starts on the surface and uses the same Spire entry as a Frontier player. */
function etherealDepthSteps(depth) {
  const label = `Ethereal ${"I".repeat(depth)}`;
  return [
    ...LAB_SPIRE_STEPS.slice(0, 3),
    {
      name: "spire-card",
      play: pressSpire,
      settleMs: 0,
      verify: ({ played }) =>
        played.state.depths.every((row) => row.button === "Enter" && row.enabled) &&
        played.state.depths.length === Object.keys(depthLooks).length
          ? completed(played)
          : failed("The Spire does not offer all researched depths", played),
    },
    {
      name: `ethereal-${depth}`,
      settleMs: 1500,
      play: async ({ browser }) => {
        const before = browser.read(SPIRE_STATE);
        browser.click(`Enter ${label}`);
        const after = await readUntil(
          () => browser.read(SPIRE_STATE),
          (shown) => shown.sent.length > before.sent.length && shown.army?.hex.row !== before.army?.hex.row,
          ORDER_OUTCOME_WAIT_MS,
        );
        const camera = await readUntil(
          () => browser.read(MAP_CAMERA),
          (camera) => camera && after.army && hexesApart(camera, after.army.hex) <= FRAMED_WITHIN_HEXES,
          SPIRE_WAIT_MS,
        );
        const terrain = await readUntil(
          () => browser.read("JSON.stringify(window.__eternumMapSelection?.etherealTerrain ?? [])"),
          (pages) => pages.some((page) => page.depth === depth && page.instances > 0),
          SPIRE_WAIT_MS,
        );
        for (let i = 0; i < ESCAPES_TO_DESELECT; i++) browser.press("Escape");
        if (!onADesktop()) {
          browser.run(["eval", "void window.__playtest.wheel(100, 4)"]);
          await sleep(ZOOM_SETTLE_MS);
        }
        const subjects = browser.read(`JSON.stringify((() => {
          const framed = element => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
          };
          return {
            army: framed(document.querySelector('.mp-at[data-key="army:${before.army.id}"] .mp-token')),
            spire: [...document.querySelectorAll('div')].some(element => element.children.length === 0 && element.textContent === "Spire" && framed(element)),
            alternateLayer: window.__eternumMapSelection?.layer,
          };
        })())`);
        return { before, after, camera, terrain, subjects, label, look: depthLooks[depth].title };
      },
      verify: ({ played }) => {
        const { before, after, camera, terrain, subjects } = played;
        if (!subjects.army || !subjects.spire || subjects.alternateLayer !== false)
          return failed("The Frontier still does not frame both the army and Spire", played);
        const command = after.sent.at(-1);
        if (
          after.sent.length !== before.sent.length + 1 ||
          command?.kind !== "EnterDepth" ||
          Number(command.fields.depth) !== depth ||
          Number(command.fields.explorer_id) !== before.army?.id
        )
          return failed("The Spire did not sign the chosen depth entry", played);
        if (
          after.army?.id !== before.army.id ||
          after.army.hex.col !== before.army.hex.col ||
          after.army.hex.row - before.army.hex.row !== depth * 100 ||
          !camera ||
          hexesApart(camera, after.army.hex) > FRAMED_WITHIN_HEXES
        )
          return failed("The army and view did not reach the chosen Frontier depth", played);
        const rendered = terrain.filter((page) => page.depth === depth && page.instances > 0);
        if (!rendered.length || rendered.some((page) => page.material !== `terrain-ethereal-depth-${depth}`))
          return failed("The committed terrain does not render the chosen material", played);
        return completed(played);
      },
    },
  ];
}

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

// Whether a button named Spire is on the page: the army's panel's way to its spire's card.
const SPIRE_BUTTON = `JSON.stringify([...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Spire"))`;

/** What selecting the army shows: the open card, if any, and whether Spire is offered. */
async function readTheArmyPanel({ browser }) {
  await sleep(HOVER_SETTLE_MS);
  return { state: browser.read(SPIRE_STATE), spireButton: browser.read(SPIRE_BUTTON) };
}

/**
 * The army selected beside its spire shows its own panel, not the spire's card, and offers Spire (owner, 2026-10-28:
 * tapping a tile with his army on it selects the army, whatever site is under it).
 */
function armyPanelOffersSpire({ played }) {
  if (played.state.sheet === "Spire") return failed("selecting the army opened the spire's card", played);
  return played.spireButton ? completed(played) : failed("the army's panel offers no Spire", played);
}

/** Presses Spire on the army's panel, the deliberate way to its spire's card. */
async function pressSpire({ browser }) {
  browser.click("Spire");
  const state = await readUntil(
    () => browser.read(SPIRE_STATE),
    (shown) => shown.sheet === "Spire",
    SPIRE_WAIT_MS,
  );
  return { spire: "Spire", state };
}

async function tapAroundTheArmyForTheSpire(browser) {
  const armyAt = armyOnScreen(browser, browser.observe().selection?.army?.id) ?? [0, 0];
  const scanned = [];
  for (const [dx, dy] of NEIGHBOUR_RING) {
    const offset = [armyAt[0] + dx, armyAt[1] + dy];
    browser.tap(offset);
    const state = await readUntil(
      () => browser.read(SPIRE_STATE),
      (shown) => shown.sheet !== null,
      SHEET_WAIT_MS,
    );
    scanned.push({ offset, tip: state.sheet });
    if (state.sheet === "Spire") return { spire: offset, scanned, state };
    if (state.sheet !== null) browser.press("Escape");
    if (!browser.observe().selection?.army) await focusTheArmyFromItsDock(browser);
  }
  return { spire: null, scanned };
}

function spireCardOffersDepths({ played, seen }) {
  const shown = { ...played.state, pressed: seen.pressed };
  if (shown.sheet !== "Spire") return failed(`Spire opened ${shown.sheet ?? "no card"}, not the spire's`, shown);
  if (!shown.army) return failed("Spire dropped the army", shown);
  const offered = shown.depths.map(({ depth, line, button, enabled }) => `${depth}|${line}|${button}|${enabled}`);
  const expected = [
    "Ethereal I|null|Enter|true",
    "Ethereal II|null|Enter|true",
    "Ethereal III|Research it to open it|Research|true",
  ];
  if (JSON.stringify(offered) !== JSON.stringify(expected))
    return failed(`the card offers ${offered.join(", ")}`, shown);
  if (!/^.+ stays until the day ends \(.+\)$/.test(shown.commitment ?? ""))
    return failed("the card does not say what entering commits the army to", shown);
  return completed(shown);
}

/** Presses Enter on Ethereal II, then reads the card and the army once the command's answer has moved the army. */
async function enterEtherealII({ browser }) {
  const before = browser.read(SPIRE_STATE);
  browser.click("Enter Ethereal II");
  const moved = (shown) => shown.sent.length > before.sent.length && shown.army?.hex.row !== before.army?.hex.row;
  const after = await readUntil(() => browser.read(SPIRE_STATE), moved, ORDER_OUTCOME_WAIT_MS);
  const framed = (camera) => camera !== null && hexesApart(camera, after.army.hex) <= FRAMED_WITHIN_HEXES;
  const camera = await readUntil(() => browser.read(MAP_CAMERA), framed, SPIRE_WAIT_MS);
  return { before, after, camera };
}

/** Where the map's camera looks, as the page reports it. */
const MAP_CAMERA = `JSON.stringify(window.__eternumMapSelection?.camera ?? null)`;

/**
 * The command the game signed for the press, and the army it moved into Ethereal II, the view switched with it: the
 * camera looks at the army's arrival, two regions from the spire, and the army is still selected (owner, 2026-11-04:
 * "spire entering lmao we should just switch view like realm/world/ethereal no ?").
 */
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
  if (played.camera === null || hexesApart(played.camera, after.army.hex) > FRAMED_WITHIN_HEXES)
    return failed("the view did not switch to the army in Ethereal II", { before, after, camera: played.camera });
  if (after.army?.id !== before.army.id)
    return failed("the army is no longer selected in Ethereal II", { before, after });
  return completed({ command, before: before.army, after: after.army, camera: played.camera });
}

/**
 * A double-click goes inside only what has an inside (the lab's camp game: the spire's army beside a Troll's camp). The
 * camp's tile leaves the map as it was, and the spire's switches the view into the Ethereal layer below it (owner,
 * 2026-11-04: "I shouldnt be able to double click a beast", "(no local mode for beasts)", "double clicking the spire
 * should make me enter the ethereal layer"). A desktop finds each tile by its order's hover.
 */
const LAB_DOUBLE_CLICK_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "pick-army", play: pickTheSpireArmy, settleMs: 1_500, verify: spireArmyPicked },
  { name: "double-click-camp", play: doubleClickTheTileOffering("Attack"), settleMs: 0, verify: leftTheMapAsItWas },
  {
    name: "double-click-spire",
    play: doubleClickTheTileOffering("Enter the Spire"),
    settleMs: 0,
    verify: viewWentIntoTheEtherealBelow,
  },
];

/** Finds the tile beside the army whose hover offers `verb`, then double-clicks it, reading the camera either side. */
function doubleClickTheTileOffering(verb) {
  return async ({ browser }) => {
    const army = browser.observe().selection?.army ?? null;
    const { target, scanned } = await findOrderTile(browser, [verb], armyOnScreen(browser, army?.id) ?? [0, 0]);
    if (!target) return { verb, tile: null, scanned };
    const before = browser.read(MAP_CAMERA);
    browser.doubleClick(target.offset);
    await sleep(DOUBLE_CLICK_SETTLE_MS);
    return { verb, tile: target.offset, army: army?.hex ?? null, before, after: browser.read(MAP_CAMERA) };
  };
}

/** The double-clicked camp opened no view of its own: the map is still the scene, its camera where it was. */
function leftTheMapAsItWas({ played, seen }) {
  if (!played.tile) return failed(`no tile beside the army offers ${played.verb}`, played);
  const scene = inScene("map")({ seen });
  if (scene.status !== "completed") return failed(`a double-click on the camp left the map: ${scene.reason}`, played);
  if (played.after === null || hexesApart(played.after, played.before) > 1)
    return failed("a double-click on the camp moved the camera", played);
  return completed(played);
}

/** The double-clicked spire switched the view into Ethereal I straight below it, on the map, a region down. */
function viewWentIntoTheEtherealBelow({ played, seen }) {
  if (!played.tile) return failed(`no tile beside the army offers ${played.verb}`, played);
  const scene = inScene("map")({ seen });
  if (scene.status !== "completed") return failed(`a double-click on the spire left the map: ${scene.reason}`, played);
  // The spire stands beside the army; Ethereal I is one region of Frontier's hundred rows below it.
  const below = { col: played.army.col, row: played.army.row + 100 };
  if (played.after === null || hexesApart(played.after, below) > FRAMED_WITHIN_HEXES)
    return failed(`the camera looks at ${JSON.stringify(played.after)}, not Ethereal I below the spire`, played);
  return completed(played);
}

/**
 * The map's layers as a player switches them (the lab's spire game, Ethereal I and II researched; owner, 4 November
 * 2026, desktop design 1 and phone B): the switch that names the layer shown opens the world and each Ethereal layer (a
 * phone's Realm too); Ethereal II takes the camera two regions down at the same spot, World back up, and from Ethereal II
 * the list takes a phone to its realm and the World tab or switch back to the map.
 */
const LAB_LAYERS_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "into-ethereal-ii", play: chooseLayer("Ethereal II"), settleMs: 0, verify: cameraInLayer(2) },
  { name: "back-to-world", play: chooseLayer("World"), settleMs: 0, verify: cameraInLayer(0) },
  { name: "ethereal-ii-again", play: chooseLayer("Ethereal II"), settleMs: 0, verify: cameraInLayer(2) },
  { name: "open-realm", play: goTo("Realm", "hex"), settleMs: 3_000, verify: inScene("hex") },
  { name: "open-map", play: goTo("Map", "map"), settleMs: 3_000, verify: inScene("map") },
];

/** Opens the list of views, reads its choices and the switch's word, chooses `word`, and reads where the camera goes. */
function chooseLayer(word) {
  return async ({ browser }) => {
    const before = browser.read(MAP_CAMERA);
    browser.openViews();
    await sleep(LIST_SETTLE_MS);
    const choices = browser.viewChoices();
    browser.chooseView(word);
    const moved = (camera) => camera !== null && hexesApart(camera, before) > FRAMED_WITHIN_HEXES;
    await readUntil(() => browser.read(MAP_CAMERA), moved, SPIRE_WAIT_MS);
    // The dive passes through the spire on its way: the camera counts once it has come to rest.
    const after = await cameraAtRest(browser);
    return { word, choices, before, after, switchWord: browser.read(VIEW_SWITCH_WORD) };
  };
}

/** The camera's tile once two reads a dive's frame apart agree, within SPIRE_WAIT_MS. */
async function cameraAtRest(browser) {
  let last = browser.read(MAP_CAMERA);
  for (const until = Date.now() + SPIRE_WAIT_MS; Date.now() < until; ) {
    await sleep(LIST_SETTLE_MS);
    const now = browser.read(MAP_CAMERA);
    if (now && last && hexesApart(now, last) === 0) return now;
    last = now;
  }
  return last;
}

/** What the switch that opens the views says: the view shown. */
const VIEW_SWITCH_WORD = `JSON.stringify(document.querySelector('nav[aria-label="Places"] [data-switch], [aria-label="Map view"] [role="tab"][aria-selected="true"]')?.textContent.trim() ?? null)`;

/** The views a lab realm with Ethereal I and II lists, and the region's rows (Frontier's spacing). */
const LAB_LAYERS = ["World", "Ethereal I", "Ethereal II"];
const REGION_ROWS = 100;

/**
 * The camera moved by regions only, to the same spot of `layer`, and the switch names that layer; the list it opened
 * held the world and each Ethereal layer, a phone's with its Realm first, the layer it left checked.
 */
function cameraInLayer(layer) {
  return ({ played, seen }) => {
    const scene = inScene("map")({ seen });
    if (scene.status !== "completed") return failed(`choosing ${played.word} left the map: ${scene.reason}`, played);
    const words = played.choices.map((choice) => choice.word);
    const listed = words[0] === "Realm" ? words.slice(1) : words;
    if (JSON.stringify(listed) !== JSON.stringify(LAB_LAYERS))
      return failed(`the views listed are ${JSON.stringify(words)}, not ${JSON.stringify(LAB_LAYERS)}`, played);
    if (played.choices.filter((choice) => choice.shown).length !== 1)
      return failed("the list did not check exactly the view shown", played);
    const { before, after } = played;
    if (before === null || after === null) return failed("the camera was not read", played);
    const rows = after.row - before.row;
    if (after.col !== before.col || rows % REGION_ROWS !== 0 || Math.floor(after.row / REGION_ROWS) % 4 !== layer)
      return failed(
        `the camera went ${JSON.stringify(before)} to ${JSON.stringify(after)}, not ${played.word}'s same spot`,
        played,
      );
    if (played.switchWord !== played.word)
      return failed(`the switch says ${played.switchWord}, not ${played.word}`, played);
    return completed(played);
  };
}

/** A list opens, and a choice closes it, in this long. */
const LIST_SETTLE_MS = 400;

/** How long a double-click's view takes to settle: a camera move, or nothing at all. */
const DOUBLE_CLICK_SETTLE_MS = 2_000;

const SPIRE_WAIT_MS = 5_000;

/** The board's buildings draw within this long, after the realm's scene holds. */
const BOARD_DRAW_MS = 10_000;
/** A tap's card opens in this long. */
const TAP_SETTLE_MS = 700;
/** The fewest buildings a sweep must find for its taps to count: the lab's realms each have eight and a castle. */
const BUILDINGS_FOUND = 4;
/** The buildings each lab realm's board lays out: eight and the castle (visit-scenario.ts, painted-buildings-scenario.ts). */
const LAB_BOARD_BUILDINGS = 9;
/** The lab visit's two realms (visit-scenario.ts): the player's own, and the neighbour's the Season's board visits. */
const LAB_HOME_REALM = 7;
const LAB_NEIGHBOUR_REALM = 8;

/**
 * A neighbour's realm visited from the Season's board (/lab/game?scenario=visit), left, and visited and left again
 * (owner, 28 October 2026: "when i'm visiting the selected panel doesnt match the actual building (hover is right) -
 * also I shouldnt be able to click on the open tiles", then "and clicking leave does that": the player's own board
 * drawn with no building models, its realm panel half off the screen). Each arrival reads which realm the board draws,
 * every building it lays out with its model attached, shown and loaded, and every HUD panel inside the screen. Each
 * board is swept, each point hovered then tapped: on a visit a building's card names what its hover named and orders
 * nothing, an open plot opens nothing, and nothing is signed; at home each building's card names its hover's building
 * and an open plot opens Build.
 */
const LAB_VISIT_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "visit", play: visitTheNeighbour, settleMs: 0, verify: visitingTheirRealm },
  { name: "visit-plots", play: sweepTheBoard, settleMs: 0, verify: aVisitReadsEachBuilding },
  { name: "leave", play: leaveTheVisit, settleMs: 0, verify: homeAgain },
  { name: "home-plots", play: sweepTheBoard, settleMs: 0, verify: eachCardIsItsHover },
  { name: "visit-again", play: visitTheNeighbour, settleMs: 0, verify: visitingTheirRealm },
  { name: "visit-again-plots", play: sweepTheBoard, settleMs: 0, verify: aVisitReadsEachBuilding },
  { name: "leave-again", play: leaveTheVisit, settleMs: 0, verify: homeAgain },
];

/**
 * A game left for the app and entered again draws its map's labels as it did on entry (owner, 2026-11-03, on a phone:
 * "when I leave game and reenter it I dont have the labels"). Leaving keeps the game booted for a return while its page
 * unmounts, the label layer with it; the return mounts a new layer, which must show the labels and plates read on entry.
 * The lab's spire game opens on the home page; the player enters by the card's Resume, leaves by the browser's Back and
 * then by the HUD's own way out, and comes back by Resume each time.
 */
function labReenterSteps() {
  let onEntry = null;
  const enter = async (context) => {
    const played = await resumeFromTheHomeCard(context);
    onEntry = played.labels;
    return played;
  };
  const resume = async (context) => ({ ...(await resumeFromTheHomeCard(context)), onEntry });
  return [
    { name: "enter", play: enter, settleMs: 0, verify: labelsDrawn },
    { name: "back", play: leaveByBack, settleMs: 0, verify: onTheAppPage },
    { name: "resume", play: resume, settleMs: 0, verify: labelsAsOnEntry },
    { name: "leave", play: leaveByTheHud, settleMs: 0, verify: onTheAppPage },
    { name: "resume-again", play: resume, settleMs: 0, verify: labelsAsOnEntry },
  ];
}

const LABELS_WAIT_MS = 15_000;
const EXIT_WAIT_MS = 10_000;
/**
 * What the map's label layer shows, or null with no layer mounted: its size, the scenes' labels drawn in it (each one's
 * words), and the plates' nodes while their box has a size (the plates fill the layer, so an unsized layer clips them).
 */
const MAP_LABELS = `JSON.stringify((() => {
  const layer = document.getElementById("labelrenderer");
  if (!layer) return null;
  const plates = layer.querySelector('[data-role="map-plates"]');
  const labels = [...layer.children].filter((each) => each !== plates && each.style.display !== "none");
  const box = plates?.getBoundingClientRect();
  return {
    layer: [layer.offsetWidth, layer.offsetHeight],
    labels: labels.length,
    words: labels.map((each) => each.innerText.trim()).filter(Boolean),
    plates: box && box.width > 0 && box.height > 0 ? plates.querySelectorAll("*").length : 0,
  };
})())`;

function labelsDrawn({ seen, played }) {
  if (!played.onMap) return inScene("map")({ seen });
  if (!played.labels?.labels) return failed("the map drew no labels on entry", played);
  return completed(played.labels);
}

/**
 * The HUD's way out of the game on a phone: Menu, then Exit. A desktop's is Settings' Leave game, which loads the page
 * afresh: the lab's game lives in the tab and does not come back from that, so a desktop leaves by Back again.
 */
async function leaveByTheHud({ browser, owner }) {
  if (onADesktop()) return leaveByBack({ browser, owner });
  browser.click("Menu");
  const exit = await readUntil(() => browser.read(buttonNamed("Exit")), Boolean, SHEET_WAIT_MS);
  if (!exit) return { missing: "Menu showed no Exit" };
  browser.click("Exit");
  return { by: "Menu, Exit", ...(await theHomePage(browser, owner)) };
}

/** One press of the browser's Back, which leaves the map for the home page the game was entered from. */
async function leaveByBack({ browser, owner }) {
  browser.run(["back"]);
  return { by: "Back", ...(await theHomePage(browser, owner)) };
}

async function theHomePage(browser, owner) {
  const path = () => browser.read("JSON.stringify(location.pathname)");
  const startedAt = Date.now();
  while (path() !== "/" && Date.now() - startedAt < EXIT_WAIT_MS) await owner.sleep(POLL_MS);
  return { path: path(), labels: browser.read(MAP_LABELS) };
}

function onTheAppPage({ played }) {
  if (played.missing) return failed(played.missing, played);
  if (played.path !== "/") return failed(`${played.by} left for ${played.path}, not the home page`, played);
  if (played.labels !== null) return failed("the game's label layer stays mounted on the home page", played);
  return completed({ by: played.by, path: played.path });
}

/** The home card's Resume, as a player returns, then the map and its labels once they are drawn. */
async function resumeFromTheHomeCard({ browser, owner }) {
  const entry = await findHomeCardEntry(browser, owner, SHEET_WAIT_MS * 6, {
    card: LAB_FROM_HOME.card,
    game: LAB_FROM_HOME,
  });
  browser.run(["click", ENTRY_BUTTON]);
  const onMap = await arrives(browser, "Map", "map");
  const labels = await readUntil(
    () => browser.read(MAP_LABELS),
    (shown) => shown?.labels > 0,
    LABELS_WAIT_MS,
  );
  return { entry: entry.entry, onMap, labels };
}

/** Back on the map, every label read on entry is drawn again, and the plates too when there were some. */
function labelsAsOnEntry({ seen, played }) {
  const { onEntry, labels } = played;
  if (!played.onMap) return inScene("map")({ seen });
  if (!onEntry) return blocked("no labels were read on entry to compare with", played);
  if (!labels?.labels) return failed(`the map drew no labels after Resume (${onEntry.labels} on entry)`, played);
  const missing = onEntry.words.filter((word) => !labels.words.includes(word));
  if (missing.length) return failed(`labels drawn on entry are missing after Resume: ${missing.join(", ")}`, played);
  if (onEntry.plates > 0 && labels.plates === 0) return failed("the map's plates are gone after Resume", played);
  return completed({ entry: played.entry, onEntry, labels });
}

const VISIT_FOOT = `JSON.stringify(document.querySelector('[role="status"][aria-label^="Visit "]')?.getAttribute("aria-label") ?? null)`;
const BOARD_HOVER = `JSON.stringify((() => {
  const label = document.querySelector('[data-label-type="hex-hover"]');
  return label ? label.dataset.buildingName : null;
})())`;
/** The card open, by its title, with its controls by their names; null with none. */
const OPEN_CARD = `JSON.stringify((() => {
  const card = document.querySelector("[data-kit-sheet]");
  if (!card) return null;
  const controls = [...card.querySelectorAll("button")].map((each) => each.getAttribute("aria-label") ?? each.textContent.trim());
  return { title: card.getAttribute("aria-label"), controls };
})())`;
const LAB_SENT = `JSON.stringify(window.__labChain?.sent.length ?? 0)`;
/**
 * What the realm's board draws, as the scene holds it (window.__gameRenderer): the realm, how many buildings its
 * layout places, and each placed building whose model is not in the scene, hidden, not grown in, or holds no geometry.
 */
const BOARD_MODELS = `JSON.stringify((() => {
  const board = window.__gameRenderer?.hexceptionScene;
  if (!board) return null;
  const shown = (model) => {
    for (let part = model; part; part = part.parent) {
      if (!part.visible) return false;
      if (part === board.scene) return true;
    }
    return false;
  };
  const loaded = (model) => {
    let vertices = 0;
    model.traverse((part) => { if (part.isMesh) vertices += part.geometry?.attributes?.position?.count ?? 0; });
    return vertices > 0;
  };
  const keys = board.buildings.map((building) => building.col + "," + building.row);
  const missing = keys.filter((key) => {
    const model = board.buildingInstances.get(key);
    return !model || !shown(model) || model.scale.y < 0.9 || !loaded(model);
  });
  return { realm: board.shownRealmId, laidOut: keys.length, missing };
})())`;

/** Resting world-space geometry against the surface actually presented under each building. */
const BOARD_GROUND_CONTACT = `JSON.stringify((() => {
  const board = window.__gameRenderer?.hexceptionScene;
  if (!board) return [];
  return board.buildings.map((building) => {
    const model = board.buildingInstances.get(building.col + "," + building.row);
    if (!model) return { category: building.category, missing: true };
    model.updateWorldMatrix(true, true);
    let base = Infinity;
    model.traverse((part) => {
      if (!part.isMesh) return;
      const positions = part.geometry.attributes.position;
      const matrix = part.matrixWorld.elements;
      for (let i = 0; i < positions.count; i++) {
        base = Math.min(base, matrix[1] * positions.getX(i) + matrix[5] * positions.getY(i) +
          matrix[9] * positions.getZ(i) + matrix[13]);
      }
    });
    const floor = board.proceduralTerrain.sampleSurface(model.position.x, model.position.z).height;
    const onScreen = model.position.clone().project(board.controls.object);
    return { category: building.category, base, floor, gap: base - floor,
      visible: model.visible && model.parent === board.scene && Math.abs(onScreen.x) < 1 && Math.abs(onScreen.y) < 1,
      path: board.modelPath(board.selectBuildingModel(building, board.tileManager.structureType())) };
  });
})())`;

const realmHeightStep = {
  name: "realm-ground-contact",
  play: async (context) => {
    await goTo("Realm", "hex")(context);
    await readUntil(
      () => context.browser.read(BOARD_MODELS),
      (board) => board && !board.missing.length,
      BOARD_DRAW_MS,
    );
    context.browser.run(["eval", "void window.__playtest.wheel(100, 8)"]);
    await sleep(SCENE_HOLD_MS);
    return context.browser.read(BOARD_GROUND_CONTACT);
  },
  settleMs: 0,
  verify: ({ seen, played }) => {
    const scene = inScene("hex")({ seen });
    if (scene.status !== "completed") return scene;
    const wrong = played.filter(
      (building) => !building.visible || !Number.isFinite(building.gap) || Math.abs(building.gap) > 0.001,
    );
    return played.length < 2 || wrong.length
      ? failed("every building kind must stand on the drawn floor", { wrong, buildings: played })
      : completed({ buildings: played });
  },
};
/** Each HUD panel and band shown that reaches past the screen's edge, by its name and its box. */
const HUD_OFF_SCREEN = `JSON.stringify([...document.querySelectorAll("section.ui-panel[aria-label], nav[aria-label]")]
  .filter((part) => part.checkVisibility({ visibilityProperty: true }))
  .map((part) => ({ name: part.getAttribute("aria-label"), box: part.getBoundingClientRect() }))
  .filter(({ box }) => box.width > 0 && (box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1))
  .map(({ name, box }) => name + " at " + [box.left, box.top, box.right, box.bottom].map(Math.round).join(",")))`;

/**
 * The board's second row, the neighbour's realm (the player leads it), by Visit: its realm drawn. No place is lit on a
 * visit to read it by: a phone's place bar gives its room to Leave.
 */
async function visitTheNeighbour({ browser }) {
  const row = await visitFromTheBoard(browser, 1);
  if (!row) return { row };
  const realm = await waitFor(browser, (seen) => seen.playable && onTheBoard(seen), SCENE_WAIT_MS);
  return { row, realm, foot: browser.read(VISIT_FOOT), ...(await theBoardDrawn(browser)) };
}

const onTheBoard = (seen) => seen.scene === "hex" && seen.rendered === "hex";

/** The board once every building it lays out stands drawn, or as it stands when that never comes; and the HUD. */
async function theBoardDrawn(browser) {
  const startedAt = Date.now();
  let board = browser.read(BOARD_MODELS);
  while (!(board?.laidOut && board.missing.length === 0) && Date.now() - startedAt < BOARD_DRAW_MS) {
    await sleep(POLL_MS);
    board = browser.read(BOARD_MODELS);
  }
  return { board, offScreen: browser.read(HUD_OFF_SCREEN) };
}

function visitingTheirRealm({ played, seen }) {
  if (!played.row) return blocked("the Season's board listed no other realm to visit", played);
  if (!played.realm || !onTheBoard(seen)) return failed("the visited realm never opened", played);
  if (!played.foot) return failed("the visit's foot with Leave is not shown", played);
  return (
    boardAndHudOf(LAB_NEIGHBOUR_REALM, played) ?? completed({ row: played.row, foot: played.foot, ...played.board })
  );
}

/**
 * Why the board or the HUD is not as a player arriving on `realm` sees it: another realm drawn, fewer buildings laid out
 * than the lab's realm holds, a building drawn without its model, a panel past the screen's edge; null when it is.
 */
function boardAndHudOf(realm, { board, offScreen }) {
  if (!board) return failed("the realm's board is not drawn", { board });
  if (board.realm !== realm) return failed(`the board draws realm ${board.realm}, not realm ${realm}`, { board });
  if (board.laidOut < LAB_BOARD_BUILDINGS)
    return failed(`the board lays out ${board.laidOut} of the realm's ${LAB_BOARD_BUILDINGS} buildings`, { board });
  if (board.missing.length)
    return failed(`${board.missing.length} buildings stand without their model: ${board.missing.join(" ")}`, { board });
  if (offScreen.length) return failed(`the HUD reaches past the screen: ${offScreen.join("; ")}`, { offScreen });
  return null;
}

/**
 * Points about a plot apart over the realm's board at its default view, each hovered then tapped: what its hover named,
 * the card the tap opened (the first one kept as a still), and how many commands the game signed meanwhile. A phone's
 * sweep keeps to the rows clear of its bands.
 */
async function sweepTheBoard({ browser, extraScreenshot }) {
  const signedBefore = browser.read(LAB_SENT);
  const taps = [];
  for (const offset of boardPoints()) {
    browser.hover(offset);
    await sleep(HOVER_SETTLE_MS);
    const hover = browser.read(BOARD_HOVER);
    browser.tap(offset);
    await sleep(TAP_SETTLE_MS);
    const card = browser.read(OPEN_CARD);
    if (card && !taps.some((tap) => tap.card)) extraScreenshot("first-card");
    taps.push({ offset, hover, card });
    browser.press("Escape");
  }
  return { taps, signed: browser.read(LAB_SENT) - signedBefore };
}

const boardPoints = () => {
  const across = Math.round(VIEWPORT.height * 0.155);
  const down = Math.round(VIEWPORT.height * 0.133);
  const rows = onADesktop() ? [-2, -1, 0, 1, 2] : [-1, 0, 1];
  return rows.flatMap((row) =>
    [-3, -2, -1, 0, 1, 2, 3]
      .map((column) => [column * across, row * down])
      .filter(([dx]) => Math.abs(dx) < VIEWPORT.width / 2 - 40),
  );
};

/** A card's one control on a viewer's tap: its close. */
const READ_ONLY = ["Close"];

/**
 * On a visit each building's card is the building its hover named, read as it stands: its close its one control (no
 * Research, Delete or Upgrade). An open plot opens nothing, and nothing is signed.
 */
function aVisitReadsEachBuilding({ played }) {
  const buildings = played.taps.filter(({ hover }) => hover);
  if (buildings.length < BUILDINGS_FOUND)
    return failed(`the sweep found ${buildings.length} buildings on the visited board`, played);
  const wrong = buildings.find(({ hover, card }) => card?.title !== hover);
  if (wrong)
    return failed(`a tap at ${wrong.offset} on ${wrong.hover} opened ${wrong.card?.title ?? "no card"}`, played);
  const ordering = buildings.find(({ card }) => card.controls.join() !== READ_ONLY.join());
  if (ordering)
    return failed(`the visit's ${ordering.card.title} card offers ${ordering.card.controls.join(", ")}`, played);
  const plot = played.taps.find(({ hover, card }) => !hover && card);
  if (plot) return failed(`an open plot at ${plot.offset} opened ${plot.card.title}`, played);
  if (played.signed) return failed(`the visit signed ${played.signed} commands`, played);
  return completed({ buildings: buildings.map(({ hover }) => hover), taps: played.taps.length });
}

async function leaveTheVisit({ browser }) {
  browser.click("Leave");
  const home = await arrives(browser, "Realm", "hex");
  return { home, foot: browser.read(VISIT_FOOT), ...(await theBoardDrawn(browser)) };
}

function homeAgain({ played, seen }) {
  if (!played.home) return failed("Leave did not bring the player's realm back", played);
  if (played.foot) return failed(`the visit's foot stays after Leave: ${played.foot}`, played);
  return boardAndHudOf(LAB_HOME_REALM, played) ?? { ...inScene("hex")({ seen }), ...played.board };
}

/** At home each building's card is the building its hover named, and an open plot opens Build. */
function eachCardIsItsHover({ played }) {
  const buildings = played.taps.filter(({ hover }) => hover);
  if (buildings.length < BUILDINGS_FOUND)
    return failed(`the sweep found ${buildings.length} buildings on the player's board`, played);
  const wrong = buildings.find(({ hover, card }) => card?.title !== hover);
  if (wrong)
    return failed(`a tap at ${wrong.offset} on ${wrong.hover} opened ${wrong.card?.title ?? "no card"}`, played);
  if (!played.taps.some(({ hover, card }) => !hover && card?.title === "Build"))
    return failed("no open plot opened Build", played);
  return completed({ buildings: buildings.map(({ hover }) => hover), taps: played.taps.length });
}

/** A lab game built on the spire's (src/lab/game): the merge games and the owner's army after its fight. */
const labSpireGame = (scenario) => ({ ...LAB_SPIRE, lab: scenario });
/** The spire's game before its player settled: the run opens on the home page, and its first step enters the game. */
const LAB_SETTLE = { ...labSpireGame("settle"), entersFromHome: true };
/** The spire's game opened on the home page: the run's first step enters it by the card's Resume. */
const LAB_FROM_HOME = { ...labSpireGame("from-home"), entersFromHome: true };
/** The spire's army, the one a player picks first: the fixture's SPIRE_ARMY. */
const PICKED_ARMY = 201;
const MERGE_WAIT_MS = 10_000;
/** Where the pointer rests between hovers: high on the map, on no army's tile. */
const POINTER_PARKED = [0, -300];
/** An army's tile below its token at the map's default zoom (a player run never zooms): its label point's height. */
const TOKEN_ABOVE_TILE_PX = 100;

/**
 * Two of the realm's armies merged as a player merges them, then hovered (owner, 2026-10-25: "due to an army merge I dont
 * see the hover label"): the spire's army picked, the other right-clicked for the transfer card, its Merge pressed (and
 * pressed again where the button then names the XP the merge loses) and answered by the chain, which keeps the army
 * tapped; then the surviving army's tile, hovered, opens its plate, and the emptied tile opens none. In merge-loses-xp
 * the picked army holds 100 XP, so the second press reads `confirm`; in merge-keeps-tapped one press merges.
 */
function labMergeSteps(confirm) {
  const tiles = { byArmy: null };
  return [
    { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
    { name: "pick-army", play: pickTheSpireArmy, settleMs: 0, verify: spireArmyPicked },
    { name: "open-merge", play: (context) => openTheMerge(context, tiles), settleMs: 0, verify: mergeCardOpen },
    { name: "merge", play: pressMerge, settleMs: 1_000, verify: (context) => mergedIntoTheTapped(context, confirm) },
    {
      name: "hover-survivor",
      play: (context) => hoverTheTileOf(context, tiles, "survivor"),
      settleMs: 0,
      verify: survivorPlateOpens,
    },
    {
      name: "hover-emptied",
      play: (context) => hoverTheTileOf(context, tiles, "emptied"),
      settleMs: 0,
      verify: noArmyPlateOpens,
    },
  ];
}

/** Realm 7, the lab's player realm, the troops its army holds before it is reinforced, and what Max then leaves. */
const LAB_REALM = 7;
const ARMY_BEFORE_REINFORCE = 1_498;
const AT_THE_CHAIN = 1_000_000_000n;
/** All 420 knights at home go, for 840 of the 1,000 wheat: the army, the knights' stock (26) and the wheat (35) after. */
const REINFORCED = {
  troops: String(1_918n * AT_THE_CHAIN),
  26: "0",
  35: String(160n * AT_THE_CHAIN),
};
/** How far below its token a realm's tile may lie at the map's zoom: the realm's token stands lower than an army's. */
const REALM_TILE_BELOW_TOKEN_PX = [70, 50, 90];
const REINFORCE_STATE = `JSON.stringify({
  sheet: document.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null,
  text: document.querySelector("[data-kit-sheet]")?.textContent ?? null,
  buttons: [...(document.querySelector("[data-kit-sheet]")?.querySelectorAll("button") ?? [])].map((button) => button.textContent.trim()),
  sent: (window.__labChain?.sent ?? []).map(({ command }) => command.kind),
  armyToken: document.querySelector('.mp-at[data-key="army:${PICKED_ARMY}"]')?.textContent ?? null,
  structure: window.__eternumMapSelection?.structure?.id ?? null,
  // The chain's answer to the reinforcement: the army's troops and each balance the realm paid from, as they stand after.
  answered: Object.fromEntries((window.__labChain?.sent ?? [])
    .filter(({ command }) => command.kind === "ManageTroops")
    .flatMap(({ answered }) => answered)
    .map(({ model, value }) => model === "ExplorerTroops" ? ["troops", String(value.troops.count)] : [String(value?.resource_type), String(value?.balance)])),
})`;
const REALM_TOKEN = `JSON.stringify((() => {
  const slot = document.querySelector('.mp-at[data-key="structure:${LAB_REALM}"]');
  if (!slot?.firstElementChild || getComputedStyle(slot).display === "none") return null;
  const token = slot.firstElementChild.getBoundingClientRect();
  return [Math.round(token.left + token.width / 2 - innerWidth / 2), Math.round(token.top + token.height / 2 - innerHeight / 2)];
})())`;

/**
 * Reinforcing as Blitz does (owner, 4 November 2026: "right click from the realm to the army opens the reinforcement"):
 * on the lab's reinforce game (src/lab/game/reinforce-scenario.ts) the realm is selected from its tile, the army beside
 * it right-clicked for the Reinforce sheet (a phone's finger taps the realm and holds the army, through DevTools' touch
 * input), Max pressed and Reinforce sent; the chain's RecruitExplorer answer leaves the army 420 knights stronger and
 * the realm with no knights and 160 wheat, and the army's token reads it.
 */
const LAB_REINFORCE_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "select-realm", play: selectTheRealm, settleMs: 0, verify: realmSelected },
  { name: "open-reinforce", play: openTheReinforcement, settleMs: 0, verify: reinforceSheetOpen },
  { name: "reinforce", play: reinforceWithMax, settleMs: 1_000, verify: armyReinforced },
];

/** A tap's finger and a hold's, as the map's gesture recognizer tells them apart (its long press is 500 ms). */
const TAP_MS = 80;
const HOLD_MS = 800;

/** Taps under the realm's token until the map has the realm selected. */
async function selectTheRealm({ browser, devTools }) {
  browser.hover(POINTER_PARKED);
  await sleep(HOVER_SETTLE_MS);
  const token = browser.read(REALM_TOKEN);
  if (!token) return { token, tapped: null };
  for (const below of REALM_TILE_BELOW_TOKEN_PX) {
    const tapped = [token[0], token[1] + below];
    // A phone plays with a finger, a desktop with the mouse.
    if (!onADesktop()) await touchAt(devTools, tapped, TAP_MS);
    else browser.tap(tapped);
    await sleep(HOVER_SETTLE_MS);
    if (browser.read(REINFORCE_STATE).structure === LAB_REALM) return { token, tapped };
  }
  return { token, tapped: null };
}

function realmSelected({ played }) {
  if (!played.token) return failed("the map draws no token for the player's realm", played);
  return played.tapped ? completed(played) : failed("no tap under the realm's token selected it", played);
}

/** Right-clicks (a phone holds) the army's tile, found under its token, with the realm selected. */
async function openTheReinforcement({ browser, devTools }) {
  if (onADesktop()) browser.hover(POINTER_PARKED);
  await sleep(HOVER_SETTLE_MS);
  const army = browser.read(ARMY_TILES)[PICKED_ARMY];
  if (!army) return { army: null, state: null };
  if (!onADesktop()) await touchAt(devTools, army, HOLD_MS);
  else browser.rightClick(army);
  const state = await readUntil(
    () => browser.read(REINFORCE_STATE),
    (shown) => shown.sheet !== null,
    MERGE_WAIT_MS,
  );
  return { army, state };
}

function reinforceSheetOpen({ played }) {
  if (!played.army) return failed("the map draws no token for the realm's army", played);
  if (played.state?.sheet !== "Reinforce Army 1")
    return failed(`the right-click on the army opened ${played.state?.sheet ?? "no card"}`, played);
  return completed({ sheet: played.state.sheet, buttons: played.state.buttons });
}

/** Max, then Reinforce, then the chain's answer: the army's token reads more troops than before. */
async function reinforceWithMax({ browser, extraScreenshot }) {
  browser.click("Max");
  await sleep(HOVER_SETTLE_MS);
  const chosen = browser.read(REINFORCE_STATE);
  extraScreenshot("max");
  browser.click("Reinforce");
  const after = await readUntil(
    () => browser.read(REINFORCE_STATE),
    (shown) =>
      shown.sent.includes("ManageTroops") && !shown.armyToken?.endsWith(ARMY_BEFORE_REINFORCE.toLocaleString("en-US")),
    MERGE_WAIT_MS,
  );
  return { chosen: chosen.text, after };
}

function armyReinforced({ played }) {
  const { after } = played;
  if (!after.sent.includes("ManageTroops")) return failed("Reinforce sent no troop command", played);
  const troops = Number((after.armyToken ?? "").replace(/^T\d/, "").replaceAll(",", ""));
  if (!(troops > ARMY_BEFORE_REINFORCE))
    return failed(`the army's token reads ${after.armyToken} after the reinforcement`, played);
  if (after.sheet?.startsWith("Reinforce")) return failed("the Reinforce sheet stays open after the answer", played);
  if (JSON.stringify(after.answered) !== JSON.stringify(REINFORCED))
    return failed(`the chain left ${JSON.stringify(after.answered)}, not ${JSON.stringify(REINFORCED)}`, played);
  return completed({ chosen: played.chosen, sent: after.sent, troops, panel: after.sheet });
}

/**
 * The owner's army just after its fight (src/lab/game/after-battle-scenario.ts): 4,015 knights on the camp they had
 * cleared, beside the ruin they attacked, both on battle cooldown. With nothing selected, hovering the army's tile opens
 * its plate (owner, 2026-10-25: "I hover the tile but no label ?").
 */
const LAB_AFTER_BATTLE_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "pick-army", play: pickTheSpireArmy, settleMs: 0, verify: spireArmyPicked },
  { name: "hover-army", play: hoverTheArmyAtRest, settleMs: 0, verify: survivorPlateOpens },
];

/**
 * The owner's fight, played (owner, 2026-10-28: "it moves the camera when I fight"): realm 7's army beside the ruin it
 * attacked on prod (src/lab/game/ruin-fight-scenario.ts). Picking the army in the HUD is a request to look at it, so the
 * camera goes to it; from there the fight leaves the camera where it was: the ruin's card opened from the map (a
 * desktop's right-click, a phone's tap), then Attack, its BattleGuard answered by the lab's chain, the ruin cleared, the
 * army's troops down by its losses, without a cash chest.
 */
const LAB_RUIN_FIGHT_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "pick-army", play: pickTheArmyAndReadTheCamera, settleMs: 0, verify: cameraWentToTheArmy },
  {
    name: "open-the-fight",
    play: openTheRuinsCardUntil(offersAttack),
    settleMs: 0,
    verify: fightCardOpenedCameraStill,
  },
  { name: "attack", play: attackTheRuin, settleMs: 0, verify: ruinClearedCameraStill },
  { name: "feed-after-the-clear", play: readTheFeedAfterTheClear, settleMs: 0, verify: theClearIsOneRow },
];
/**
 * The owner's card of 31 October ("I should still have the projection even if I'm too far I think"): the army two tiles
 * from the ruin (`scenario=ruin-far`), its card opened from the map. Each side reads what this attack leaves it, and
 * Attack waits for the army to get there.
 */
const LAB_RUIN_FAR_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "pick-army", play: pickTheArmyAndReadTheCamera, settleMs: 0, verify: cameraWentToTheArmy },
  { name: "open-the-far-card", play: openTheRuinsCardUntil(showsBothSides), settleMs: 0, verify: farCardForecasts },
];
/** The ruin beside the army (site-fixture.ts) and how near a framed army stands to the camera's target, in hexes. */
const LAB_RUIN = 710;
const FRAMED_WITHIN_HEXES = 6;
/** What a player sees of the fight: where the camera looks, the army, the card, the ruin's and army's tokens, the chest. */
const FIGHT_STATE = `JSON.stringify({
  camera: window.__eternumMapSelection?.camera ?? null,
  army: window.__eternumMapSelection?.army ?? null,
  sheet: document.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null,
  buttons: [...(document.querySelector("[data-kit-sheet]")?.querySelectorAll("button") ?? [])].map((button) => button.textContent.trim()),
  ruinRule: document.querySelector("[data-ruin-rule] .text-hud-ink")?.textContent ?? null,
  attackHeld: [...(document.querySelector("[data-kit-sheet]")?.querySelectorAll("button") ?? [])].every((button) => !button.textContent.trim().startsWith("Attack") || button.disabled),
  sides: [...(document.querySelector("[data-kit-sheet]")?.querySelectorAll('[role="img"][aria-label*="→"]') ?? [])].map((side) => side.getAttribute("aria-label")),
  sent: (window.__labChain?.sent ?? []).map(({ command }) => command.kind),
  armyToken: document.querySelector('.mp-at[data-key="army:${PICKED_ARMY}"]')?.textContent ?? null,
  ruinToken: (() => {
    const slot = document.querySelector('.mp-at[data-key="structure:${LAB_RUIN}"]');
    if (!slot || getComputedStyle(slot).display === "none" || !slot.firstElementChild) return null;
    const token = slot.firstElementChild.getBoundingClientRect();
    return [
      Math.round(token.left + token.width / 2 - innerWidth / 2),
      Math.round(token.top + token.height / 2 + ${TOKEN_ABOVE_TILE_PX} - innerHeight / 2),
    ];
  })(),
  // Cash-chest presentation must remain absent after a ruin clear.
  chest: Boolean(document.querySelector('[data-chest-moment] [aria-label$=" LORDS"]')),
})`;

/** Picks the army from the HUD, as the Armies list or the dock does, reading where the camera looked before and after. */
async function pickTheArmyAndReadTheCamera({ browser }) {
  browser.hover(POINTER_PARKED);
  const before = browser.read(FIGHT_STATE).camera;
  const picked = await pickTheSpireArmy({ browser });
  await sleep(CAMERA_REPORT_MS);
  return { ...picked, before, after: browser.read(FIGHT_STATE) };
}

/** The pick is a request to look: the camera went to the army. */
function cameraWentToTheArmy({ played }) {
  const { before, after } = played;
  if (!played.army) return failed(`no army on the HUD selects army ${PICKED_ARMY}`, played);
  if (!after.camera || !after.army) return failed("the page reports no camera or no selected army", played);
  if (hexesApart(after.camera, after.army.hex) > FRAMED_WITHIN_HEXES)
    return failed(`the camera looks at ${JSON.stringify(after.camera)}, away from the army`, played);
  return completed({ before, after: after.camera, army: after.army.hex });
}

/**
 * On a phone the ruin is first panned low, just above the picked army's row, where its card, taller than the row, will
 * cover it once open (the owner's taps met fights there): a camera that framed the tapped tile above its card would
 * show here as a move. Its tile's offset below the screen's middle, in pixels: under the card, still clear of the row.
 */
const UNDER_THE_CARD_PX = [70, 160];
/** How far from the middle a ruin may stand across a phone and still be tapped whole: a far ruin is panned within. */
const ACROSS_THE_PHONE_PX = [-120, 120];
const PAN_BURSTS = 16;
const underTheCard = (token) => token && token[1] >= UNDER_THE_CARD_PX[0] && token[1] <= UNDER_THE_CARD_PX[1];
async function panTheRuinUnderTheCard(browser) {
  await panTheRuinInto(browser, 0, ACROSS_THE_PHONE_PX, ["KeyA", "KeyD"]);
  await panTheRuinInto(browser, 1, UNDER_THE_CARD_PX, ["KeyW", "KeyS"]);
}

/**
 * Pans the map in bursts along one axis until the ruin's token stands within `band` on it. `keys` are first taken as
 * the one that moves the token forward on the axis and the one that moves it back; a key that moved it the other way
 * is turned round.
 */
async function panTheRuinInto(browser, axis, band, keys) {
  let [forward, back] = keys;
  let last = browser.read(FIGHT_STATE).ruinToken;
  for (let burst = 0; burst < PAN_BURSTS && last && (last[axis] < band[0] || last[axis] > band[1]); burst += 1) {
    const ahead = last[axis] < band[0];
    browser.run(["eval", `void window.__playtest.pan(["${ahead ? forward : back}"], 30)`]);
    await sleep(CAMERA_REPORT_MS);
    const now = browser.read(FIGHT_STATE).ruinToken;
    if (now && (ahead ? now[axis] < last[axis] : now[axis] > last[axis])) [forward, back] = [back, forward];
    last = now;
  }
}

function offersAttack(shown) {
  return shown.buttons.some((text) => text.startsWith("Attack"));
}
function showsBothSides(shown) {
  return shown.sides.length === 2;
}

/**
 * Opens the ruin's card from the map with the army selected, a desktop's right-click, a phone's tap, and reads it
 * once it shows what `ready` waits for.
 */
function openTheRuinsCardUntil(ready) {
  return async ({ browser, extraScreenshot }) => {
    if (!onADesktop()) await panTheRuinUnderTheCard(browser);
    const before = browser.read(FIGHT_STATE);
    if (!before.ruinToken) return { before, after: before };
    extraScreenshot("before-fight");
    if (onADesktop()) browser.rightClick(before.ruinToken);
    else browser.tap(before.ruinToken);
    const after = await readUntil(() => browser.read(FIGHT_STATE), ready, MERGE_WAIT_MS);
    extraScreenshot("fight-card");
    return { before, after };
  };
}

/** The far card forecasts both sides, each with what this attack leaves it, and holds Attack back. */
function farCardForecasts({ played }) {
  const { before, after } = played;
  if (!before.ruinToken) return failed("the map draws no token for the ruin", played);
  if (!showsBothSides(after)) return failed("the ruin's card shows no fight", played);
  if (after.sides.some((side) => side.endsWith("—"))) return failed(`no forecast: ${after.sides.join(" · ")}`, played);
  if (!after.attackHeld) return failed("Attack can be pressed from out of reach", played);
  return completed({ sheet: after.sheet, sides: after.sides, buttons: after.buttons });
}

function fightCardOpenedCameraStill({ played }) {
  const { before, after } = played;
  if (after.ruinRule !== null) return failed("a relic ruin must not show a daily entitlement", played);
  if (!before.ruinToken) return failed("the map draws no token for the ruin", played);
  if (!onADesktop() && !underTheCard(before.ruinToken))
    return failed("the ruin could not be panned under where its card opens", played);
  if (!after.buttons.some((text) => text.startsWith("Attack")))
    return failed("the ruin's card offers no Attack", played);
  if (!before.camera) return failed("the page reports no camera", played);
  if (!sameHex(before.camera, after.camera))
    return failed(`opening the fight moved the camera from ${JSON.stringify(before.camera)}`, played);
  return completed({ camera: after.camera, sheet: after.sheet, buttons: after.buttons });
}

/** Presses Attack, then waits for the chain's answer: the ruin gone and the surviving troops shown. */
async function attackTheRuin({ browser, extraScreenshot }) {
  const before = browser.read(FIGHT_STATE);
  const attack = before.buttons.find((text) => text.startsWith("Attack"));
  if (attack) browser.click(attack);
  const after = await readUntil(
    () => browser.read(FIGHT_STATE),
    (shown) => shown.sent.includes("BattleGuard") && shown.ruinToken === null && shown.armyToken?.includes("4,011"),
    MERGE_WAIT_MS,
  );
  extraScreenshot("cleared-ruin");
  await sleep(CAMERA_REPORT_MS);
  return { attack, before, after, settled: browser.read(FIGHT_STATE) };
}

/**
 * The Feed after the ruin's clear (owner, 31 October: "in the feed can this be a single line ?"): the attack that
 * cleared the ruin is told by the clear's one row, with no row of its own. A desktop opens the Feed from its place, a
 * phone from its place bar. Rows are read by their story (`data-story`, src/ui/features/event-feed/feed-line.tsx).
 */
async function readTheFeedAfterTheClear({ browser }) {
  const opened = browser.observe().panels.includes(HUD_WORDS.feed) || (await openTheFeed(browser));
  const rows = await readUntil(
    () => browser.read(FEED_ROW_STORIES),
    (stories) => stories.includes("SitePayout"),
    MERGE_WAIT_MS,
  );
  return { opened, rows };
}

/** The Feed opened as a player opens it: a desktop's Feed place, a phone's place bar. */
async function openTheFeed(browser) {
  if (!onADesktop()) return tapTheFeed(browser);
  browser.click(HUD_WORDS.feed);
  await sleep(1_500);
  return browser.observe().panels.includes(HUD_WORDS.feed);
}

const FEED_ROW_STORIES = `JSON.stringify([...document.querySelectorAll("[data-feed-line]")].map((row) => row.dataset.story))`;

function theClearIsOneRow({ played }) {
  if (!played.opened) return failed(`the ${HUD_WORDS.feed} did not open`, played);
  const clears = played.rows.filter((story) => story === "SitePayout").length;
  if (clears !== 1) return failed(`the Feed shows ${clears} rows for the ruin's clear`, played);
  if (played.rows.includes("BattleEvent"))
    return failed("the attack that cleared the ruin has a row of its own", played);
  return completed(played);
}

function ruinClearedCameraStill({ played }) {
  const { before, after, settled } = played;
  if (!played.attack) return failed("no Attack to press", played);
  if (!after.sent.includes("BattleGuard")) return failed("Attack sent no BattleGuard", played);
  if (after.ruinToken !== null) return failed("the ruin still stands on the map", played);
  if (after.chest || settled.chest) return failed("a retired cash chest showed", played);
  if (!settled.armyToken?.includes("4,011")) return failed(`the army's token reads ${settled.armyToken}`, played);
  if (!before.camera) return failed("the page reports no camera", played);
  if (!sameHex(before.camera, settled.camera))
    return failed(`the fight moved the camera from ${JSON.stringify(before.camera)}`, played);
  return completed({
    camera: { before: before.camera, after: settled.camera },
    army: settled.armyToken,
    sent: after.sent,
  });
}

/**
 * The owner's army after its fight, nothing selected, at each zoom step from the closest to the farthest (owner,
 * 2026-10-27: "at a certain zoom level I cant get the hover modal"): its token stands over its own model, and the pointer
 * anywhere on its model, feet to head, opens its plate, at every step; so does every other army drawn, such as the
 * realm's second army beside it in the merge game (owner, 2026-10-28: "again on desktop the hover label disappears at a
 * certain zoom level"). The page reports its world (dev overlays), so each model is hovered where the renderer draws it.
 */
const LAB_HOVER_ZOOM_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "pick-army", play: pickTheSpireArmy, settleMs: 0, verify: spireArmyPicked },
  { name: "hover-every-zoom", play: hoverEveryArmyAtEveryZoom, settleMs: 0, verify: armiesAnswerAtEveryZoom },
];
/**
 * The spire's game on high ground (owner, 2026-10-27: "when exploring a tile thats not empty the tile selection to move
 * bugs"): with the army selected, every tile it is offered is lit above all of the snow, rock and tundra under it, so no
 * lit tile is cut or hidden by its own ground. The page reports its world (dev overlays): the plates as drawn and the
 * ground the renderer samples.
 */
const LAB_HIGH_GROUND_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "pick-army", play: pickTheSpireArmy, settleMs: 1_500, verify: spireArmyPicked },
  { name: "lit-tiles-on-ground", play: readTheLitTiles, settleMs: 0, verify: litTilesClearTheirGround },
];
/** Every lit plate's height beside the highest ground under its face, read on a 0.1 grid out to its corners. */
const LIT_PLATES = `JSON.stringify((() => {
  const world = window.__gameRenderer?.worldmapScene;
  if (!world) return null;
  const terrain = world.getTerrainSurface();
  return world.highlightHexManager.getDebugState().plates.map(({ x, y, z }) => {
    let ground = -Infinity;
    for (let dx = -0.9; dx <= 0.9001; dx += 0.1)
      for (let dz = -0.9; dz <= 0.9001; dz += 0.1)
        if (Math.hypot(dx, dz) <= 0.9001) ground = Math.max(ground, terrain.sampleSurface(x + dx, z + dz).height);
    return { x, z, y, ground };
  });
})())`;

/** The selected army's lit tiles, read as drawn, once their roll-in has ended. */
async function readTheLitTiles({ browser, extraScreenshot }) {
  await sleep(HOVER_SETTLE_MS);
  extraScreenshot("lit");
  return { plates: browser.read(LIT_PLATES) };
}

/** Every lit plate lies above the highest ground under it. */
function litTilesClearTheirGround({ played }) {
  const { plates } = played;
  if (!plates) return failed("the page does not report its world (window.__gameRenderer): no plate measured");
  if (plates.length === 0) return failed("the selected army is offered no lit tile");
  const buried = plates.filter((plate) => plate.y <= plate.ground);
  const clearance = Math.min(...plates.map((plate) => plate.y - plate.ground));
  return buried.length === 0
    ? completed({ plates: plates.length, clearance })
    : failed(`${buried.length} of ${plates.length} lit plates lie under their own ground`, { buried, clearance });
}

/** Points on an army's model as drawn, its tile (0) to its top (1): the head is where the tile behind lay. */
const MODEL_SHARES = [0.2, 0.6, 1];
/**
 * A point on a model, `share` of the way from its tile to its top on screen, kept a pixel inside the top: the pointer
 * stands on a whole pixel, and one rounded from the top itself may stand over it.
 */
const onTheModel = ({ tile, top }, share) => {
  const inside = Math.min(share, 1 - 1 / Math.max(1, Math.hypot(top.x - tile.x, top.y - tile.y)));
  return { x: tile.x + (top.x - tile.x) * inside, y: tile.y + (top.y - tile.y) * inside };
};
/** Wheel notches from the closest zoom past which the farthest must have been reached. */
const ZOOM_STEPS_MAX = 14;

/** Every army's label in a plate reading. */
const armyLabels = (seen) => seen?.things?.filter((thing) => thing.key?.startsWith("army:")) ?? [];

/**
 * Lets the army go, zooms all the way in, then at each notch out reads every army's token and hovers each army's model,
 * feet to head.
 */
async function hoverEveryArmyAtEveryZoom({ browser, extraScreenshot }) {
  for (let press = 0; press < ESCAPES_TO_DESELECT; press += 1) browser.press("Escape");
  browser.run(["eval", `void window.__playtest.wheel(-100, ${ZOOM_IN_NOTCHES})`]);
  await sleep(ZOOM_SETTLE_MS);
  const page = browser.read("JSON.stringify({ width: innerWidth, height: innerHeight })");
  const offsetOf = ({ x, y }) => [Math.round(x - page.width / 2), Math.round(y - page.height / 2)];
  const zooms = [];
  for (let notch = 0; notch <= ZOOM_STEPS_MAX; notch += 1) {
    browser.hover(POINTER_PARKED);
    await sleep(HOVER_SETTLE_MS);
    const distance = browser.observe().worldmapDistance;
    const armies = [];
    for (const rest of armyLabels(browser.read(PLATES_EXPRESSION))) {
      const hovers = [];
      for (const share of rest.over ? MODEL_SHARES : []) {
        browser.hover(offsetOf(onTheModel(rest.over, share)));
        await sleep(HOVER_SETTLE_MS * 2);
        const seen = armyLabels(browser.read(PLATES_EXPRESSION)).find((thing) => thing.key === rest.key);
        hovers.push({ share, opened: seen?.open === true });
      }
      browser.hover(POINTER_PARKED);
      await sleep(HOVER_SETTLE_MS);
      const against = againstTheirThings({ things: [rest] });
      armies.push({ key: rest.key, rest: against.standing[0] ?? null, offModel: against.off.length > 0, hovers });
    }
    extraScreenshot(`zoom-${notch}`);
    zooms.push({ distance, armies });
    if (Math.abs(distance - FARTHEST_CAMERA_DISTANCE) <= CLOSEST_DISTANCE_TOLERANCE) break;
    browser.run(["eval", "void window.__playtest.wheel(100, 1)"]);
    await sleep(ZOOM_SETTLE_MS);
  }
  return { zooms };
}

/**
 * From the closest zoom to the farthest, the picked army read at every step, and every army read with its token over its
 * model and its plate open wherever its model is hovered.
 */
function armiesAnswerAtEveryZoom({ played }) {
  const { zooms } = played;
  const near = (distance, target) => Math.abs(distance - target) <= CLOSEST_DISTANCE_TOLERANCE;
  if (!near(zooms[0]?.distance, CLOSEST_CAMERA_DISTANCE) || !near(zooms.at(-1)?.distance, FARTHEST_CAMERA_DISTANCE))
    return failed("the camera did not step from the closest zoom to the farthest", played);
  const picked = `army:${PICKED_ARMY}`;
  const undrawn = zooms.filter((zoom) => !zoom.armies.some((army) => army.key === picked && army.hovers.length > 0));
  if (undrawn.length > 0)
    return failed(`army ${PICKED_ARMY}'s token or model is not read at ${undrawn.length} zooms`, {
      ...played,
      undrawn,
    });
  const readAt = (test) =>
    zooms.flatMap((zoom) => zoom.armies.filter(test).map((army) => ({ distance: zoom.distance, ...army })));
  const off = readAt((army) => !army.rest || army.offModel);
  if (off.length > 0) return failed(`${off.length} army tokens stand off their models`, { ...played, off });
  const closed = readAt((army) => army.hovers.some((hover) => !hover.opened));
  return closed.length === 0
    ? completed(played)
    : failed(`hovering an army's model opens no plate ${closed.length} times`, { ...played, closed });
}

// The open card and its buttons, the commands the lab's chain has been sent, and the army a merge's answer destroyed.
const MERGE_STATE = `JSON.stringify({
  sheet: document.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null,
  buttons: [...(document.querySelector("[data-kit-sheet]")?.querySelectorAll("button") ?? [])].map((button) => button.textContent.trim()),
  sent: (window.__labChain?.sent ?? []).map(({ command }) => command.kind),
  destroyed: (window.__labChain?.sent ?? []).flatMap(({ answered }) =>
    answered.filter(({ model, value }) => model === "ExplorerTroops" && value === null).map(({ key }) => Number(key.split(":")[1]))),
})`;
// Each army's token drawn at rest, and the tile under it, as offsets from the screen's centre.
const ARMY_TILES = `JSON.stringify(Object.fromEntries([...document.querySelectorAll('.mp-at[data-key^="army:"]')]
  .filter((slot) => slot.querySelector(".mp-token") && getComputedStyle(slot).display !== "none")
  .map((slot) => {
    const token = slot.firstElementChild.getBoundingClientRect();
    return [slot.dataset.key.split(":")[1], [
      Math.round(token.left + token.width / 2 - innerWidth / 2),
      Math.round(token.top + token.height / 2 + ${TOKEN_ABOVE_TILE_PX} - innerHeight / 2),
    ]];
  })))`;

/** Picks each army from the HUD until the map has the spire's selected: the camera comes onto it. */
async function pickTheSpireArmy({ browser }) {
  const armies = browser.armies();
  for (const { label } of armies) {
    await pickArmy(browser, label);
    if (browser.observe().selection?.army?.id === PICKED_ARMY) return { armies, army: label };
  }
  return { armies, army: null };
}

function spireArmyPicked({ played }) {
  return played.army ? completed(played) : failed(`no army on the HUD selects army ${PICKED_ARMY}`, played);
}

/** Notes both armies' tiles from their tokens at rest, then right-clicks the other army's, as a player opens the card. */
async function openTheMerge({ browser }, tiles) {
  browser.hover(POINTER_PARKED);
  await sleep(HOVER_SETTLE_MS);
  tiles.byArmy = browser.read(ARMY_TILES);
  const other = Object.keys(tiles.byArmy).find((id) => Number(id) !== PICKED_ARMY);
  if (!other) return { tiles: tiles.byArmy, state: null };
  browser.rightClick(tiles.byArmy[other]);
  const state = await readUntil(
    () => browser.read(MERGE_STATE),
    (shown) => shown.sheet !== null,
    MERGE_WAIT_MS,
  );
  return { tiles: tiles.byArmy, state };
}

function mergeCardOpen({ played }) {
  if (Object.keys(played.tiles ?? {}).length !== 2)
    return failed("the map does not draw the realm's two armies", played);
  if (!played.state?.sheet) return failed("the right-click on the other army opened no card", played);
  const merge = played.state.buttons.find((text) => text.startsWith("Merge into"));
  return merge ? completed({ ...played, merge }) : failed("the card offers no Merge", played);
}

/**
 * Presses the card's Merge and, when the button then asks again with the XP the merge loses, that button too; then waits
 * for the chain's answer to leave the realm one army.
 */
async function pressMerge({ browser }) {
  const before = browser.read(MERGE_STATE);
  const merge = before.buttons.find((text) => text.startsWith("Merge into"));
  if (merge) browser.click(merge);
  const asked = await readUntil(
    () => browser.read(MERGE_STATE),
    (shown) => shown.sent.length > 0 || shown.buttons.some((text) => text.startsWith("Lose ")),
    MERGE_WAIT_MS,
  );
  const confirm = asked.sent.length > 0 ? null : (asked.buttons.find((text) => text.startsWith("Lose ")) ?? null);
  if (confirm) browser.click(confirm);
  const after = await readUntil(
    () => ({ ...browser.read(MERGE_STATE), armies: browser.armies() }),
    (shown) => shown.destroyed.length === 1 && shown.armies.length === 1,
    MERGE_WAIT_MS,
  );
  return { merge, confirm, before, after };
}

/** The merge asked again only where it loses XP, in those words; it sent the transfer, and only the army tapped is left. */
function mergedIntoTheTapped({ played }, confirm) {
  if (!played.merge) return failed("no Merge to press", played);
  if (played.confirm !== confirm)
    return failed(
      confirm ? `the merge never asked "${confirm}"` : `a merge that loses no XP asked "${played.confirm}"`,
      played,
    );
  if (!played.after.sent.includes("ManageTroops")) return failed("Merge sent no troop transfer", played);
  if (played.after.destroyed.length !== 1) return failed("the chain's answer destroyed no army", played);
  if (played.after.destroyed[0] !== PICKED_ARMY)
    return failed(`the merge kept the army picked, not army ${played.after.destroyed[0]} it was merged into`, played);
  if (played.after.armies.length !== 1)
    return failed(`the HUD lists ${played.after.armies.length} armies after the merge`, played);
  return completed({
    merge: played.merge,
    confirm: played.confirm,
    sent: played.after.sent,
    destroyed: played.after.destroyed[0],
    left: played.after.armies,
  });
}

/** Rests the pointer off the armies, then hovers a tile, and reads the labels drawn. */
async function hoverAndRead(browser, extraScreenshot, offset, name) {
  browser.hover(POINTER_PARKED);
  await sleep(HOVER_SETTLE_MS);
  browser.hover(offset);
  await sleep(HOVER_SETTLE_MS * 2);
  return { plates: browser.read(PLATES_EXPRESSION), shot: extraScreenshot(name) };
}

/** Hovers the survivor's tile or the one the merge emptied, both noted before the merge. */
async function hoverTheTileOf({ browser, extraScreenshot }, tiles, which) {
  const [emptied] = browser.read(MERGE_STATE).destroyed;
  const survivor = Object.keys(tiles.byArmy ?? {})
    .map(Number)
    .find((id) => id !== emptied);
  const offset = tiles.byArmy?.[which === "survivor" ? survivor : emptied];
  if (!offset) return { which, survivor, emptied, offset: null };
  return { which, survivor, emptied, offset, ...(await hoverAndRead(browser, extraScreenshot, offset, which)) };
}

/** Lets the army go (Escape), then hovers its tile, found under its token. */
async function hoverTheArmyAtRest({ browser, extraScreenshot }) {
  for (let press = 0; press < ESCAPES_TO_DESELECT; press += 1) browser.press("Escape");
  browser.hover(POINTER_PARKED);
  await sleep(HOVER_SETTLE_MS);
  const offset = browser.read(ARMY_TILES)[PICKED_ARMY] ?? null;
  const selected = browser.observe().selection?.army ?? null;
  if (!offset) return { survivor: PICKED_ARMY, offset, selected };
  return { survivor: PICKED_ARMY, offset, selected, ...(await hoverAndRead(browser, extraScreenshot, offset, "army")) };
}

const openArmyPlates = (plates) =>
  (plates?.things ?? []).filter((thing) => thing.kind === "plate" && thing.open && thing.key?.startsWith("army:"));

function survivorPlateOpens({ played }) {
  const opened = openArmyPlates(played.plates).map(({ key, text }) => ({ key, text }));
  const shown = { survivor: played.survivor, offset: played.offset, selected: played.selected, opened };
  if (!played.offset) return failed(`no token drawn for army ${played.survivor}`, shown);
  return opened.some(({ key }) => key === `army:${played.survivor}`)
    ? completed(shown)
    : failed(`hovering army ${played.survivor}'s tile opens no plate for it`, shown);
}

function noArmyPlateOpens({ played }) {
  const opened = openArmyPlates(played.plates).map(({ key, text }) => ({ key, text }));
  const shown = { survivor: played.survivor, emptied: played.emptied, offset: played.offset, opened };
  if (!played.offset) return failed("no tile noted for the emptied army", shown);
  return opened.length === 0 ? completed(shown) : failed("the emptied tile opens an army's plate", shown);
}

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
  totals: ["35Reveals", "5Sites cleared", "0Chests", "+7.2KEssence", "+524Labor", "+0LORDS"],
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

/** The screen back up on the new day with the camera on the realm's site that day. */
const cameraOnSite =
  (site, day) =>
  ({ played }) => {
    const { before, after } = played;
    if (after.phase !== "day") return failed(`the screen is still on the day's end (${after.phase})`, played);
    const on = after.camera;
    if (!on || Math.abs(on.col - site.col) > 1 || Math.abs(on.row - site.row) > 1)
      return failed(
        `the camera looks at ${JSON.stringify(on)}, not the realm's ${day} site ${JSON.stringify(site)}`,
        played,
      );
    return completed({ before: before.camera, after: on, site });
  };

const cameraOnTheNewSite = cameraOnSite(LAB_DAY_3_SITE, "day-3");

/**
 * The owner's phone (owner, 2026-10-25: "eventually I go back to mobile and it doesnt reload the map I get a black
 * screen"): in the game a minute before day 2 ends, the tab goes to the background (its window minimized, the page then
 * frozen as a phone freezes it), losing its WebGL context as a phone takes it, and Herald's stream goes silent with its
 * socket still open; past the day's end the tab comes back. On WebGL the lost context must boot the page again and the
 * map draw; on WebGPU, whose device this machine keeps, the silent stream must be dropped and resumed. Either way the
 * day's summary shows and Continue brings the camera onto the realm's day-3 site.
 */
function labDayTurnAsleepSteps() {
  /** The night, from the tab going away to the map drawn again: the later steps read what the sleep left. */
  const night = {};
  return [
    { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
    {
      name: "tab-sleeps",
      // Each run's night replaces the one before.
      play: async (context) => Object.assign(night, await sleepThroughTheDayEnd(context)),
      settleMs: 0,
      verify: sleptBeforeTheEnd,
    },
    {
      name: "tab-wakes",
      play: (context) => wakeTheTab(context, night),
      settleMs: 0,
      verify: ({ played }) => wokeIntoTheEndedDay(played, night),
    },
    { name: "continue", play: continueIntoTheNewDay, settleMs: 0, verify: cameraOnTheNewSite },
    {
      name: "map-draws",
      play: readTheMapDrawn,
      settleMs: 0,
      verify: ({ played }) => mapDrawsAsBeforeSleep(played, night),
    },
  ];
}

/**
 * A device arriving in day 3 with no summary to read (day-later-quiet: day 2 not played; day-later-played-on: the player
 * played on in day 3 on another device): the day's end still plays, and behind its black the camera comes onto the
 * realm's day-3 site.
 */
const labDayLaterNoSummarySteps = [
  { name: "enter-on-map", settleMs: 0, verify: inScene("map") },
  { name: "into-the-new-day", play: waitForTheNewDay, settleMs: 0, verify: cameraOnTheNewSiteWithNoSummary },
];

/** Long enough past day 2's end, the tab put away up to a minute before it, for the end to pass while it sleeps. */
const ASLEEP_MS = 80_000;
/** The page boots again and its history answers after the tab is back. */
const WOKEN_WAIT_MS = 90_000;
const DAY_END_PASS_MS = 20_000;
/** A pixel this dark (0–255 grey) is the black of an undrawn canvas, below the map's darkest drawn ground. */
const DARK_LEVEL = 12;
/** The share of the band an undrawn map leaves black past what the map before the night did. */
const BLACK_MAP_SHARE = 0.5;
/** The map's middle band on a phone, clear of the HUD's top strip and its foot. */
const MAP_BAND = { left: 0.1, top: 0.3, width: 0.8, height: 0.3 };

/** What the tab is as it goes away: the game's GPU, Herald's streams and the page's load. */
const TAB_STATE = `JSON.stringify({
  visibility: document.visibilityState,
  gpu: document.getElementById("main-canvas")?.getContext("webgl2") ? "webgl2" : "webgpu",
  streams: window.__labChain?.streams ?? null,
  loadedAt: performance.timeOrigin,
})`;
/** The phone puts the tab away: its WebGL context is lost, if it has one, and Herald's stream goes silent. */
const TAB_GOES_AWAY = `(() => {
  const lost = document.getElementById("main-canvas")?.getContext("webgl2")?.getExtension("WEBGL_lose_context");
  lost?.loseContext();
  window.__labChain?.silence();
  return JSON.stringify({ visibility: document.visibilityState, contextLost: Boolean(lost) });
})()`;

/** The driven page's value for an expression, read through DevTools: it reaches a page that is not the front tab. */
async function readInPage(devTools, expression) {
  const { result } = await devTools.send("Runtime.evaluate", { expression, returnByValue: true });
  return JSON.parse(result.value ?? "null");
}

/**
 * The map's middle band in a screenshot of the page: its share of near-black pixels. A lost canvas draws nothing, so the
 * band is black but for the labels and HUD over it.
 */
async function readTheMapBand(devTools, path) {
  const { data } = await devTools.send("Page.captureScreenshot", { format: "png" });
  const image = Buffer.from(data, "base64");
  const { width, height } = await sharp(image).metadata();
  const band = {
    left: Math.round(width * MAP_BAND.left),
    top: Math.round(height * MAP_BAND.top),
    width: Math.round(width * MAP_BAND.width),
    height: Math.round(height * MAP_BAND.height),
  };
  await sharp(image).toFile(path);
  const grey = await sharp(image).extract(band).greyscale().raw().toBuffer();
  const dark = grey.filter((level) => level < DARK_LEVEL).length / grey.length;
  return { path, band, dark: Math.round(dark * 1000) / 1000 };
}

/** The window the page is drawn in, minimized (the page hidden) or brought back (shown). */
async function setWindowState(devTools, windowState) {
  const { windowId } = await devTools.sendToBrowser("Browser.getWindowForTarget", { targetId: devTools.targetId });
  await devTools.sendToBrowser("Browser.setWindowBounds", { windowId, bounds: { windowState } });
}

/**
 * Puts the tab away a while: its window minimized, the game's GPU and Herald's stream gone as a phone loses them, the
 * page frozen; then the tab is left asleep past the day's end.
 */
async function sleepThroughTheDayEnd({ base, browser, devTools }) {
  const awake = { ...browser.read(DAY_END_STATE), tab: await readInPage(devTools, TAB_STATE) };
  const mapAwake = await readTheMapBand(devTools, `${base}-awake.png`);
  const loggedBefore = consoleLines(browser).length;
  await setWindowState(devTools, "minimized");
  await sleep(500);
  const away = await readInPage(devTools, TAB_GOES_AWAY);
  await devTools.send("Page.setWebLifecycleState", { state: "frozen" });
  await sleep(ASLEEP_MS);
  return { awake, mapAwake, away, loggedBefore };
}

const consoleLines = (browser) =>
  browser
    .run(["console"], { allowFailure: true })
    .split("\n")
    .map((line) => line.trim());

function sleptBeforeTheEnd({ played }) {
  const { awake, away } = played;
  if (awake.phase !== "day" || awake.card !== null)
    return failed(
      `day 2 had already ended (${awake.phase}, ${awake.card ?? "no card"}) before the tab went away`,
      played,
    );
  if (away.visibility !== "hidden")
    return failed(`the tab stayed ${away.visibility} with its window minimized`, played);
  if (awake.tab.gpu === "webgl2" && !away.contextLost)
    return failed("the tab's WebGL context could not be lost", played);
  return completed(played);
}

/**
 * Brings the tab back: the page let run, its window shown again; then waits for the ended day's summary. The context
 * loss the sleep provoked is logged by the client as an error, which is this step's outcome.
 */
async function wakeTheTab({ browser, devTools, extraScreenshot }, { loggedBefore }) {
  await devTools.send("Page.setWebLifecycleState", { state: "active" });
  await setWindowState(devTools, "normal");
  await sleep(1_000);
  extraScreenshot("woken");
  const shown = await readUntil(
    () => readWhileLoading(browser),
    (state) => state?.card !== null && state?.card !== undefined,
    WOKEN_WAIT_MS,
  );
  const provokedErrors = contextLossErrors(consoleLines(browser).slice(loggedBefore));
  return { ...shown, tab: await readInPage(devTools, TAB_STATE), provokedErrors };
}

/** A read of the day's end that a page booting again may not answer yet. */
function readWhileLoading(browser) {
  try {
    return browser.read(DAY_END_STATE);
  } catch {
    return null;
  }
}

function wokeIntoTheEndedDay(played, night) {
  const shown = summaryShows(RECORDED_DAY_2)({ played });
  if (shown.status !== "completed") return shown;
  const before = night.awake.tab;
  const rebooted = played.tab.loadedAt !== before.loadedAt;
  if (before.gpu === "webgl2" && !rebooted)
    return failed("the tab lost its WebGL context and did not boot again: its map stays black", played);
  if (before.gpu === "webgpu" && played.tab.streams < 2)
    return failed("Herald's silent stream was never dropped: the tab still waits on the slept socket", played);
  return completed({ ...played, rebooted });
}

async function readTheMapDrawn({ base, devTools }) {
  return readTheMapBand(devTools, `${base}-map.png`);
}

/** The map drawn after the night as before the tab went away: its middle band no more black than it was, near enough. */
function mapDrawsAsBeforeSleep(played, night) {
  const awake = night.mapAwake;
  if (played.dark > awake.dark + BLACK_MAP_SHARE)
    return failed(`the map is black (${played.dark} of its middle band, ${awake.dark} before the tab slept)`, {
      awake,
      drawn: played,
    });
  return completed({ awake, drawn: played });
}

/** Reads the day's end through its phases until its summary shows or the day is back up, for at most `timeoutMs`. */
function waitForADayTurn(timeoutMs) {
  return async ({ browser }) => {
    const before = browser.read(DAY_END_STATE);
    const phases = [before.phase];
    let shown = before;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      await sleep(POLL_MS);
      shown = browser.read(DAY_END_STATE);
      if (phases.at(-1) !== shown.phase) phases.push(shown.phase);
      if (shown.card !== null || (phases.length > 1 && shown.phase === "day")) break;
    }
    await sleep(CAMERA_REPORT_MS);
    return { before, after: browser.read(DAY_END_STATE), phases };
  };
}

/** Waits for the day's end a device arriving in a new day goes through, and reads where the camera then looks. */
function waitForTheNewDay(context) {
  return waitForADayTurn(DAY_END_PASS_MS)(context);
}

function cameraOnTheNewSiteWithNoSummary({ played }) {
  if (played.after.card !== null) return failed(`a summary shows (${played.after.card}) for a day not played`, played);
  const camera = cameraOnTheNewSite({ played });
  return camera.status === "completed" ? completed({ ...camera, phases: played.phases }) : camera;
}

/** The lab opens the game 30 s before day 1, and the turn's mist and black follow: past both, whatever the boot took. */
const SEASON_OPENS_WAIT_MS = 60_000;
/**
 * A player in the season before its first day (src/lab/game/season-opens-scenario.ts), as dev's game 6 was entered on
 * 10-26: the map draws while their realm has no site yet, then day 1's turn plays, with no summary for a day before the
 * season, and leaves the camera on the realm's first site.
 */
const LAB_SEASON_OPENS_STEPS = [
  { name: "enter-on-map", settleMs: 3_000, verify: inScene("map") },
  { name: "into-day-1", play: waitForADayTurn(SEASON_OPENS_WAIT_MS), settleMs: 0, verify: dayOneTurnedOntoTheRealm },
];
/** Realm 7's site on day 1 of the lab's calendar: its region's column, the first row of regions (contract hexes). */
const LAB_DAY_1_SITE = { col: 650, row: 50 };
const cameraOnTheFirstSite = cameraOnSite(LAB_DAY_1_SITE, "day-1");

function dayOneTurnedOntoTheRealm({ played }) {
  if (played.phases.length < 2) return failed("day 1 began with no turn played", played);
  if (played.after.card !== null) return failed(`a summary shows (${played.after.card}) before any day`, played);
  const camera = cameraOnTheFirstSite({ played });
  return camera.status === "completed" ? completed({ ...camera, phases: played.phases }) : camera;
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
const STILL_MS = 6_000;

/**
 * The realm view as a player first meets it: the game entered on its map (a cold cache, as a first visit), the first
 * press of Realm (the realm's models, ground and props load now), the realm held still, back to the map, the realm
 * again, and the realm's address loaded again (a warm HTTP cache; the map boots first and hands off). A lab game is
 * opened again on its realm, its chain being the tab's. Each step reports its downloads, GPU work, long frames, the
 * frames where the drawn scene changed and the scene marks (requested, presentable); `--viewport 390x844` plays it at
 * a phone's size.
 */
const realmLoadSteps = (labScenario = null) => [
  { name: "map-still", play: holdStill, settleMs: 0, verify: inScene("map") },
  { name: "first-realm", play: goTo("Realm", "hex"), settleMs: 0, verify: inScene("hex") },
  { name: "realm-still", play: holdStill, settleMs: 0, verify: inScene("hex") },
  { name: "back-to-map", play: goTo("Map", "map"), settleMs: 0, verify: inScene("map") },
  { name: "realm-again", play: goTo("Realm", "hex"), settleMs: 0, verify: inScene("hex") },
  { name: "reload-on-realm", play: reloadOn("Realm", "hex", labScenario), settleMs: 0, verify: inScene("hex") },
];

async function holdStill() {
  await sleep(STILL_MS);
  return {};
}

/**
 * The page's address loaded again in the same browser, as a player's refresh: it is playable on `place` again. A lab
 * game is opened again on that scene, its chain being the tab's. Returns the new page's entry milestones (warm cache).
 */
function reloadOn(place, scene, labScenario = null) {
  const reload = labScenario
    ? `(() => {
        const lab = new URL("/lab/game", location.origin);
        lab.searchParams.set("scenario", ${JSON.stringify(labScenario)});
        lab.searchParams.set("scene", ${JSON.stringify(scene)});
        for (const [key, value] of new URLSearchParams(location.search)) {
          if (key === "rendererMode" || key === "dev") lab.searchParams.set(key, value);
        }
        setTimeout(() => location.assign(lab), 0);
      })()`
    : "setTimeout(() => location.reload(), 0)";
  return async ({ browser }) => {
    const before = browser.observe();
    browser.run(["eval", reload]);
    const back = await waitFor(
      browser,
      (seen) => seen.timeOrigin !== before.timeOrigin && seen.playable && isIn(seen, place, scene),
      PLAYABLE_WAIT_MS,
    );
    if (back) await sleep(SCENE_HOLD_MS);
    return {
      reloaded: browser.observe().timeOrigin !== before.timeOrigin,
      milestones: browser.read("JSON.stringify(window.__eternumGameEntryTimeline ?? [])"),
    };
  };
}

/** Each approved family through the real map, HUD and local keep, opened through the lab game's route. */
const devconArtSteps = Object.entries(realmSkins).flatMap(([skin, { directory, label }]) =>
  realmAssets
    .filter((asset) => !asset.wonder)
    .flatMap(({ id, level }) => {
      const expected = { path: `/models/realms/devcon/${directory}/${id}.glb`, icon: homeIcons[skin][level], label };
      return [
        {
          name: `${skin}-${id}-map`,
          settleMs: 1_000,
          play: async ({ browser }) => {
            const url = new URL(browser.run(["get", "url"]));
            url.pathname = "/lab/game";
            url.search = new URLSearchParams({ scenario: `${skin}-${level}` }).toString();
            browser.run(["open", url.href]);
            await waitFor(browser, (seen) => seen.playable && isIn(seen, "Map", "map"), PLAYABLE_WAIT_MS);
            await sleep(SCENE_HOLD_MS);
            return readDevconArt(browser, expected);
          },
          verify: devconArtShown("map"),
        },
        {
          name: `${skin}-${id}-realm`,
          settleMs: 1_000,
          play: async (context) => {
            await goTo("Realm", "hex")(context);
            await sleep(SCENE_HOLD_MS);
            context.extraScreenshot("scene");
            context.browser.tap([0, 0]);
            await sleep(1_000);
            const castle = context.browser.read("JSON.stringify(!!document.querySelector('[data-castle-card]'))");
            context.extraScreenshot("castle");
            context.browser.run(["press", "Escape"]);
            if (!onADesktop()) {
              context.browser.click(HUD_WORDS.menu);
              await sleep(500);
              context.browser.click(HUD_WORDS.realmLabor);
              await sleep(1_000);
            }
            return { ...readDevconArt(context.browser, expected), castle };
          },
          verify: devconArtShown("hex"),
        },
      ];
    }),
);

function readDevconArt(browser, expected) {
  return {
    expected,
    ...browser.read(`JSON.stringify({
    assets: JSON.parse(window.__playtest.read()).resources.map(entry => entry.url.replace(/[.][0-9a-f]{12}(?=[.]glb$)/, "")),
    icons: [...document.querySelectorAll('img')].filter(img => img.complete && img.naturalWidth > 0).map(img => new URL(img.currentSrc).pathname),
    text: document.body.innerText,
    markers: [...document.querySelectorAll('[data-marker]')].map(node => node.dataset.marker),
  })`),
  };
}

function devconArtShown(scene) {
  return ({ seen, played }) => {
    const view = inScene(scene)({ seen });
    if (view.status !== "completed") return view;
    const { expected, assets, icons, text } = played;
    if (scene === "hex" && !played.castle) return failed("the central keep did not open its castle card", played);
    if (!assets.includes(expected.path)) return failed("approved realm model was not loaded", played);
    if (!icons.some((path) => path.endsWith(`/${expected.icon}.webp`)))
      return failed("campaign HUD icon is missing", played);
    if (onADesktop() && !text.includes(expected.label))
      return failed("campaign identity is missing from the HUD", played);
    return completed(played);
  };
}

const devconSeasonStep = {
  name: "devcon-season",
  play: async ({ browser }) => {
    if (!onADesktop()) {
      browser.click(HUD_WORDS.menu);
      await sleep(500);
    }
    browser.click(HUD_WORDS.season);
    await sleep(2_000);
    return browser.read(
      `JSON.stringify([...document.querySelectorAll('section[aria-label="${HUD_WORDS.season}"] img')].map(img => img.complete && img.naturalWidth > 0 ? new URL(img.currentSrc).pathname.split('/').pop() : null))`,
    );
  },
  verify: ({ seen, played }) => {
    if (!seen.panels.includes(HUD_WORDS.season)) return failed("Season did not open", played);
    const campaigns = Object.keys(realmSkins).map((skin) =>
      Object.values(homeIcons[skin]).map((icon) => `${icon}.webp`),
    );
    if (
      !campaigns.every((icons) => icons.some((icon) => played.includes(icon))) ||
      !played.some((icon) => /^realm-[0-3][.]webp$/.test(icon)) ||
      !Object.values(homeIcons.wonder).some((icon) => played.includes(`${icon}.webp`))
    )
      return failed("Season must distinguish both unvisited campaign homes, the ordinary home, and the Wonder", played);
    return completed(played);
  },
};

/**
 * The game entered, cold then warm, and what keeps running once it is: the boot (a fresh profile), then a still window
 * read for the frame callbacks, timers, CSS animations, hidden full-screen layers and canvases still alive after the
 * doorway handed off, then the same address loaded again from the HTTP cache and the same read. A player enters through
 * the home page's card (`--player`), a spectator by the Watch link; the lab's built Kingdom needs no live game.
 */
const entrySteps = (labScenario = null) => [
  { name: "after-entry", play: readWhatKeepsRunning, settleMs: 0, verify: inScene("map") },
  { name: "reload-on-map", play: reloadOn("Map", "map", labScenario), settleMs: 0, verify: inScene("map") },
  { name: "after-reload", play: readWhatKeepsRunning, settleMs: 0, verify: inScene("map") },
];

const LEFTOVER_WINDOW_MS = 10_000;

/**
 * Two readings of what the page keeps running, a still window apart (`compareCensus`), and the first seconds of play
 * after the doorway dropped, judged from one continuous frame record (`judgeAfterDoorway`). The record is kept beside
 * its judgment, so the judgment can be replayed from what was observed.
 */
async function readWhatKeepsRunning({ browser }) {
  const before = browser.read("window.__playtest.census()");
  await sleep(LEFTOVER_WINDOW_MS);
  const keepsRunning = compareCensus(before, browser.read("window.__playtest.census()"));
  const dismissedAt = browser.read(DISMISSED_AT_EXPRESSION);
  const { frames, readAt } =
    dismissedAt === null ? { frames: [], readAt: null } : browser.read(`window.__playtest.framesFrom(${dismissedAt})`);
  const doorwayFrames = { dismissedAt, frames, readAt };
  return {
    keepsRunning,
    doorwayFrames,
    afterDoorway: judgeAfterDoorway({ dismissedAt: dismissedAt ?? Number.NaN, frames }),
  };
}

/** The page time the doorway dropped at on this page (a reload has its own), or null. */
const DISMISSED_AT_EXPRESSION = `JSON.stringify(
  (window.__eternumGameEntryTimeline ?? []).find((milestone) => milestone.name === "overlay-dismissed")?.timestamp ?? null
)`;

/**
 * The player commands Frontier's preset enables that no lab action step sends, each with why none does. Every other one
 * is measured by the step that declares it (`sends`), on desktop and phone, with baselines; action-coverage.test.ts
 * fails a command that is neither.
 */
export const UNMEASURED_COMMANDS = {
  ApplyRelic: "army relic activation has a control, but its desktop and phone timing baselines are not recorded",
  MarkGameSettled:
    "sent by the value relay's operator once a season's game has ended (apps/value-relay), never by a player",
  SetEntityName: "no control in the game sends it: only the provider's set_entity_name, which nothing calls",
};

/**
 * Places shared out of the player's view, opened from their messages and left again (the lab's far-place game: the
 * neighbour's realm and army, which the player's Herald scope does not carry, shared in Global). Playtest 29 October
 * 2026, B5.
 */
const FAR_PLACE_STEPS = [
  { name: "enter-on-map", settleMs: 8_000, verify: inScene("map") },
  { name: "open-far-realm", play: openTheFarPlace("structure"), settleMs: 0, verify: openedTheFarPlace("structure") },
  { name: "leave-far-realm", play: leaveTheFarVisit, settleMs: 0, verify: leftForHome },
  { name: "open-far-army", play: openTheFarPlace("army"), settleMs: 0, verify: openedTheFarPlace("army") },
  { name: "leave-far-army", play: leaveTheFarVisit, settleMs: 0, verify: leftForHome },
];

/**
 * Deploy a small army through the normal dock, then delete it from its panel's trash: Cancel keeps it, and the
 * confirm's Delete removes it for good.
 */
function armyManagementSteps() {
  let armyId;
  const count = (browser) =>
    browser.read(
      `JSON.stringify(document.querySelector('.mp-at[data-key="army:${armyId}"] .mp-count')?.textContent ?? null)`,
    );
  /** The sheet's button named verb (the trash by its label), or the delete confirm's with `asked`. */
  const press = async (browser, verb, asked = false) => {
    const within = asked ? '[data-kit-sheet] [role="alertdialog"]' : "[data-kit-sheet]";
    const button = await readUntil(() => browser.read(sheetButton(`^${verb}$`, within)), Boolean, SHEET_WAIT_MS);
    if (!button) throw new Error(`Army sheet has no ${verb} button`);
    browser.tap(button.offset);
  };
  return [
    ...FRONTIER_MAP.opening,
    {
      name: "deploy-rehearsal-army",
      play: async ({ browser }) => {
        armyId = undefined;
        const before = browser.armies().map(({ label }) => label);
        await deployFromTheDock({ browser }, 10);
        const arrived = await readUntil(
          () => browser.armies().find(({ label }) => !before.includes(label)),
          Boolean,
          ORDER_OUTCOME_WAIT_MS,
        );
        if (!arrived) return { arrived: false };
        await pickArmy(browser, arrived.label);
        armyId = browser.observe().selection?.army?.id;
        if (onADesktop()) return { armyId, troops: count(browser) };
        browser.click(`${arrived.label}: details`);
        return { armyId, troops: count(browser) };
      },
      settleMs: 10_000,
      verify: ({ played }) =>
        played.armyId && played.troops === "10"
          ? completed(played)
          : failed("small army not deployed and selected", played),
    },
    {
      name: "delete-rehearsal-army",
      play: async ({ browser, extraScreenshot }) => {
        if (!armyId || browser.observe().selection?.army?.id !== armyId) return { armyId, selected: false };
        await press(browser, "Delete");
        const loss = browser.read(
          `JSON.stringify(document.querySelector('[role="alertdialog"]')?.textContent ?? null)`,
        );
        const fits = browser.read(`JSON.stringify((() => {
          const dialog = document.querySelector('[role="alertdialog"]');
          const sheet = dialog?.closest('[data-kit-sheet]');
          if (!dialog || !sheet) return false;
          const bounds = sheet.getBoundingClientRect();
          return [dialog, ...dialog.querySelectorAll('button')].every((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left >= Math.max(0, bounds.left) && rect.right <= Math.min(innerWidth, bounds.right);
          });
        })())`);
        extraScreenshot("delete-confirmation");
        if (!fits || !loss?.includes("troops, skills, XP and carried resources are lost")) return { loss, fits };
        await press(browser, "Cancel", true);
        const retained = count(browser) === "10";
        if (!retained) return { armyId, loss, retained };
        await press(browser, "Delete");
        await press(browser, "Delete", true);
        const removed = await readUntil(
          () => count(browser) === null && !browser.observe().selection?.army,
          Boolean,
          ORDER_OUTCOME_WAIT_MS,
        );
        return { armyId, loss, fits, retained, removed };
      },
      settleMs: 10_000,
      verify: ({ played }) =>
        played.fits && played.retained && played.removed
          ? completed(played)
          : failed("army deletion or cancellation did not settle", played),
    },
  ];
}

export const STEP_SETS = {
  "army-stock": {
    game: FRONTIER,
    steps: [
      ...FRONTIER_MAP.opening,
      { name: "open-realm", play: goTo("Realm", "hex"), settleMs: 3_000, verify: inScene("hex") },
      {
        name: "build-rehearsal-barracks",
        play: async ({ browser }) => {
          const built = await buildOnAnOpenPlot({ browser }, "Barracks");
          if (!built.plot) return built;
          await readUntil(() => browser.read(SHEET_NAME) !== "Build", Boolean, ORDER_OUTCOME_WAIT_MS);
          browser.press("Escape");
          browser.tap(built.plot);
          const sheet = await readUntil(
            () => browser.read(SHEET_NAME),
            (name) => name === "Barracks",
            SHEET_WAIT_MS,
          );
          return { ...built, sheet };
        },
        settleMs: 3_000,
        verify: ({ played }) =>
          played.sheet === "Barracks"
            ? completed(played)
            : failed("Barracks did not appear on the chosen plot", played),
      },
    ],
  },
  "army-management": { game: FRONTIER, steps: armyManagementSteps() },
  spectator: { game: FRONTIER, steps: SPECTATOR_STEPS },
  "map-frames": { game: FRONTIER, steps: MAP_FRAME_STEPS },
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
  "home-found-regular": {
    game: { ...FRONTIER, entersFromHome: true },
    steps: [
      {
        name: "found-regular-campaign-home",
        play: async ({ browser, extraScreenshot }) => {
          const tier = await readUntil(
            () =>
              browser.read(
                `JSON.stringify(document.querySelector('.home-picker__featured .home-art')?.getAttribute('data-tier') ?? null)`,
              ),
            Boolean,
            PLAYABLE_WAIT_MS,
          );
          extraScreenshot("source-choice");
          if (tier !== "regular") return { tier, founded: false };
          browser.click("Create your realm");
          return { tier, founded: true };
        },
        settleMs: 5_000,
        verify: ({ played }) =>
          played.tier === "regular" && played.founded
            ? completed(played)
            : failed("regular campaign source was not offered", played),
      },
      ...FRONTIER_MAP.opening,
      {
        name: "read-founded-regular-home",
        play: async ({ browser }) => {
          await openRealmLabor(browser);
          return readCampaignClaim(browser);
        },
        settleMs: 1_000,
        verify: ({ played }) =>
          played.tier === "regular" && !played.claimed
            ? completed(played)
            : failed("founded regular home with an unpaid claim was not confirmed", played),
      },
    ],
  },
  "home-upgrade": {
    game: FRONTIER,
    steps: [
      ...FRONTIER_MAP.opening,
      {
        name: "upgrade-campaign-home",
        play: async ({ base, browser, owner, extraScreenshot }) => {
          await openRealmLabor(browser);
          const before = readCampaignClaim(browser);
          extraScreenshot("regular");
          if (before.tier !== "regular" || before.claimed) return { before };
          writeFileSync(`${base}-upgrade-ready.json`, JSON.stringify({ ready: true, before }), {
            mode: 0o600,
            flag: "wx",
          });
          const applied = await waitUntil(() => {
            owner.throwIfCancelled();
            return existsSync(`${base}-upgrade-applied.json`);
          }, 180_000);
          if (!applied) throw new Error("operator upgrade deadline");
          const upgraded = await readUntil(
            () => readCampaignClaim(browser),
            (state) => state.tier === "golden",
            ORDER_OUTCOME_WAIT_MS,
          );
          extraScreenshot("golden");
          if (!upgraded || upgraded.claimed) return { before, upgraded };
          const claim = await claimFoundedHome({ browser });
          return { before, upgraded, claimed: claim.claimed, after: readCampaignClaim(browser) };
        },
        settleMs: 3_000,
        verify: ({ played }) =>
          played.before?.tier === "regular" &&
          played.upgraded?.tier === "golden" &&
          played.claimed &&
          played.after?.claimed
            ? completed(played)
            : failed("golden upgrade and prospective claim did not settle", played),
      },
    ],
  },
  "home-golden": {
    game: FRONTIER,
    steps: [
      ...FRONTIER_MAP.opening,
      {
        name: "read-golden-home-after-reload",
        play: async ({ browser }) => {
          await openRealmLabor(browser);
          return readCampaignClaim(browser);
        },
        settleMs: 1_000,
        verify: ({ played }) =>
          played.tier === "golden" && played.claimed
            ? completed(played)
            : failed("golden claim did not survive a fresh load", played),
      },
    ],
  },
  "home-recovery": {
    game: { ...FRONTIER, entersFromHome: true },
    steps: [
      {
        name: "inspect-daily-source-choice",
        play: async ({ browser, extraScreenshot }) => {
          const offered = await readUntil(
            () =>
              browser.read(`JSON.stringify(document.querySelector('.home-picker__featured h3')?.textContent ?? null)`),
            (name) => Boolean(name && name !== "A free home"),
            PLAYABLE_WAIT_MS,
          );
          if (!offered) return { offered };
          const screenshot = extraScreenshot("choice");
          browser.click("Continue with my free home");
          return { offered, screenshot };
        },
        settleMs: 5_000,
        verify: ({ played }) =>
          played.offered ? completed(played) : failed("daily source choice not offered", played),
      },
      {
        name: "recover-and-claim-home",
        play: async ({ base, browser, owner }) => {
          const ready = `${base}-registration-ready.json`;
          const registered = `${base}-registered.json`;
          writeFileSync(ready, JSON.stringify({ ready: true }), { mode: 0o600, flag: "wx" });
          if (
            !(await waitUntil(() => {
              owner.throwIfCancelled();
              return existsSync(registered);
            }, 180_000))
          )
            throw new Error("operator registration deadline");
          return claimFoundedHome({ browser });
        },
        settleMs: 3_000,
        verify: ({ played }) =>
          played.claimed ? completed(played) : failed("daily claim not shown as claimed", played),
      },
    ],
  },
  "home-claim": {
    game: FRONTIER,
    steps: [
      ...FRONTIER_MAP.opening,
      {
        name: "claim-founded-home",
        play: claimFoundedHome,
        settleMs: 3_000,
        verify: ({ played }) =>
          played.claimed ? completed(played) : failed("the daily claim did not become claimed in the sheet", played),
      },
    ],
  },
  "stale-release": {
    game: FRONTIER,
    steps: [
      ...FRONTIER_MAP.opening,
      {
        name: "stale-release-move",
        play: moveAcrossRelease,
        settleMs: 10_000,
        verify: ({ played, actionLatency, window }) => {
          if (!played.army || !played.target) return blocked("no adjacent Move offered", played);
          if (!played.firstSent || !played.applied) return failed("release boundary was not exercised", played);
          const orders = describeOrders({ armyTrace: actionLatency.armyMovement, ...window });
          return played.stale
            ? completed({ orders, cost: played.cost, message: played.message })
            : failed("the held move did not report stale release", { orders, ...played });
        },
      },
    ],
  },
  actions: { game: FRONTIER, steps: ACTION_STEPS },
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
  "lab-devcon-art": { game: { ...LAB_SPIRE, lab: "devcon-0" }, steps: devconArtSteps },
  "lab-devcon-season": { game: { ...LAB_SPIRE, lab: "devcon-season" }, steps: [devconSeasonStep] },
  "lab-spire": { game: LAB_SPIRE, steps: LAB_SPIRE_STEPS },
  "lab-layers": { game: LAB_SPIRE, steps: LAB_LAYERS_STEPS },
  ...Object.fromEntries(
    Object.keys(depthLooks).map((depth) => [
      `lab-ethereal-${depth}`,
      { game: { ...LAB_SPIRE, lab: "ethereal-depths" }, steps: etherealDepthSteps(Number(depth)) },
    ]),
  ),
  "lab-merge-loses-xp": {
    game: labSpireGame("merge-loses-xp"),
    steps: labMergeSteps("Lose 100 XP, merge into Army 2"),
  },
  "lab-merge-keeps-tapped": { game: labSpireGame("merge-keeps-tapped"), steps: labMergeSteps(null) },
  "lab-reinforce": { game: labSpireGame("reinforce"), steps: LAB_REINFORCE_STEPS },
  "lab-actions": { game: labSpireGame("actions"), steps: ACTION_STEPS },
  "lab-actions-spire": { game: LAB_SPIRE, steps: SPIRE_ACTION_STEPS },
  "lab-double-click": { game: { ...LAB_SPIRE, lab: "camp" }, steps: LAB_DOUBLE_CLICK_STEPS },
  "lab-actions-merge": { game: labSpireGame("merge-loses-xp"), steps: mergeActionSteps() },
  "lab-economy": { game: { ...labSpireGame("economy"), mode: "blitz" }, steps: ECONOMY_STEPS },
  "lab-actions-transfer": { game: labSpireGame("merge-loses-xp"), steps: transferActionSteps() },
  "lab-actions-deploy": { game: labSpireGame("actions"), steps: DEPLOY_ACTION_STEPS },
  "lab-actions-research": { game: labSpireGame("research"), steps: RESEARCH_ACTION_STEPS },
  "lab-daily-quest": { game: labSpireGame("quest"), steps: DAILY_QUEST_STEPS },
  "lab-actions-claim": { game: labSpireGame("claim"), steps: CLAIM_ACTION_STEPS },
  "lab-far-place": { game: labSpireGame("far-place"), steps: FAR_PLACE_STEPS, devOverlays: true },
  "lab-relic-forecasts": { game: labSpireGame("relics"), steps: RELIC_FORECAST_STEPS },
  "lab-no-lords": {
    game: labSpireGame("upkeep"),
    steps: [
      ARMY_ACTION_STEPS[0],
      {
        name: "no-lords-controls",
        play: async ({ browser }) => {
          const panel = await openTheArmyPanel(browser);
          const controls = browser.read(
            `JSON.stringify([...document.querySelectorAll("button")].map(button => button.getAttribute("aria-label") ?? button.textContent.trim()).filter(label => /^(Refill|Withdraw|Deposit LORDS|LORDS )/.test(label)))`,
          );
          return { panel, controls };
        },
        settleMs: 0,
        verify: ({ played }) =>
          played.panel?.sheet === played.panel?.army && played.controls?.length === 0
            ? completed(played)
            : failed("Army panel missing or retired LORDS controls present", played),
      },
    ],
  },
  "lab-actions-army": { game: labSpireGame("upkeep"), steps: ARMY_ACTION_STEPS },
  "lab-actions-demolish": { game: labSpireGame("upkeep"), steps: DEMOLISH_ACTION_STEPS },
  "lab-actions-settle": { game: LAB_SETTLE, steps: SETTLE_ACTION_STEPS },
  "lab-aspect-settle": { game: { ...labSpireGame("aspect-settle"), entersFromHome: true }, steps: ASPECT_SETTLE_STEPS },
  "lab-actions-fight": { game: labSpireGame("fight"), steps: FIGHT_ACTION_STEPS },
  "lab-actions-fight-lost": { game: labSpireGame("fight-lost"), steps: FIGHT_LOST_STEPS },
  "lab-actions-sites": { game: labSpireGame("sites"), steps: SITE_ACTION_STEPS },
  "lab-hud-devices": { game: labSpireGame("sites"), steps: HUD_DEVICE_STEPS },
  "lab-after-battle": { game: labSpireGame("after-battle"), steps: LAB_AFTER_BATTLE_STEPS },
  "lab-visit": { game: labSpireGame("visit"), steps: LAB_VISIT_STEPS, devOverlays: true },
  "lab-reenter": { game: LAB_FROM_HOME, steps: labReenterSteps() },
  "lab-ruin-fight": { game: labSpireGame("ruin-fight"), steps: LAB_RUIN_FIGHT_STEPS },
  "lab-ruin-far": { game: labSpireGame("ruin-far"), steps: LAB_RUIN_FAR_STEPS },
  "lab-hover-zoom": { game: labSpireGame("after-battle"), steps: LAB_HOVER_ZOOM_STEPS, devOverlays: true },
  "lab-hover-zoom-pair": { game: labSpireGame("merge-loses-xp"), steps: LAB_HOVER_ZOOM_STEPS, devOverlays: true },
  "lab-high-ground": { game: labSpireGame("high-ground"), steps: LAB_HIGH_GROUND_STEPS, devOverlays: true },
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
  "lab-realm-height": {
    game: { ...LAB_SPIRE, lab: "realm-height" },
    steps: [realmHeightStep],
    devOverlays: true,
  },
  "lab-day-turn-asleep": { game: labDayTurn("day-turn-asleep"), steps: labDayTurnAsleepSteps() },
  "lab-day-later-quiet": { game: labDayTurn("day-later-quiet"), steps: labDayLaterNoSummarySteps },
  "lab-day-later-played-on": { game: labDayTurn("day-later-played-on"), steps: labDayLaterNoSummarySteps },
  "lab-season-opens": { game: labDayTurn("season-opens"), steps: LAB_SEASON_OPENS_STEPS },
  entry: { game: FRONTIER, steps: entrySteps() },
  "lab-entry": { game: { ...LAB_SPIRE, lab: "painted-buildings" }, steps: entrySteps("painted-buildings") },
  "realm-load": { game: FRONTIER, steps: realmLoadSteps() },
  "lab-realm-load": { game: { ...LAB_SPIRE, lab: "painted-buildings" }, steps: realmLoadSteps("painted-buildings") },
  "blitz-realm-load": { game: BLITZ, steps: realmLoadSteps() },
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

/** The live daily claim, verified by the same claimed-day state the player reads. */
function readCampaignClaim(browser) {
  return browser.read(`JSON.stringify((() => {
    const sheet = document.querySelector(${JSON.stringify(REALMS_SHEET)});
    return {
      tier: sheet?.querySelector('.home-art')?.getAttribute('data-tier') ?? null,
      claimed: sheet?.querySelector('[aria-current="date"]')?.getAttribute('data-state') === 'claimed',
      days: sheet?.querySelectorAll('.realm-labor__days li').length ?? 0,
      text: sheet?.innerText ?? null,
    };
  })())`);
}

async function claimFoundedHome({ browser }) {
  const pressed = await claimARealmsLabor({ browser });
  const claimed =
    pressed.watching &&
    (await readUntil(
      () =>
        browser.read(
          `document.querySelector(${JSON.stringify(REALMS_SHEET)})?.querySelector('[aria-current="date"]')?.getAttribute('data-state') === 'claimed'`,
        ),
      Boolean,
      ORDER_OUTCOME_WAIT_MS,
    ));
  return {
    ...pressed,
    claimed: Boolean(claimed),
    sheetText: browser.read(
      `JSON.stringify(document.querySelector(${JSON.stringify(REALMS_SHEET)})?.innerText ?? null)`,
    ),
  };
}

/** Holds a real signed move until the operator applies a compatible release; no RPC answer is fabricated. */
async function moveAcrossRelease({ base, browser, devTools, extraScreenshot, owner }) {
  if (onADesktop()) throw new Error("stale-release needs the phone viewport for tap then Enter");
  const ready = `${base}-release-ready.json`;
  const applied = `${base}-release-applied.json`;
  if (existsSync(ready) || existsSync(applied)) throw new Error("release evidence already exists; use a new run");
  let army = await focusTheArmyFromItsDock(browser);
  if (!army) {
    await deployFromTheDock({ browser });
    await owner.sleep(6_000);
    army = await focusTheArmyFromItsDock(browser);
  }
  if (!army) return { army };
  await exploreBesideArmy({ browser, extraScreenshot });
  await owner.sleep(6_000);
  const observation = watchReleaseMove(devTools);
  const gate = await openOrderSendGate(devTools);
  try {
    const move = await orderBesideArmy({ browser, extraScreenshot }, "Move");
    const target = move.target;
    if (!target) return { army, target, offered: move.offered };
    const firstSent = await waitUntil(() => gate.held() > 0, ORDER_SEND_WAIT_MS);
    if (!firstSent) return { army, target, firstSent };
    await observation.before();
    extraScreenshot("held");
    writeFileSync(ready, JSON.stringify({ ready: true }), { mode: 0o600, flag: "wx" });
    const released = await waitUntil(() => {
      owner.throwIfCancelled();
      return existsSync(applied);
    }, 180_000);
    if (!released) throw new Error("release application deadline; held move not used as proof");
    const lines = await linesLoggedDuring(browser, () => gate.close());
    const message = browser.read("JSON.stringify(document.body.innerText)");
    extraScreenshot("refused");
    await owner.sleep(10_000);
    const cost = await observation.measure();
    writeFileSync(`${base}-release-observed.json`, JSON.stringify({ observed: true, cost }), {
      mode: 0o600,
      flag: "wx",
    });
    return {
      army,
      target,
      firstSent,
      applied: true,
      stale: cost.attempts.some((attempt) => attempt.staleRelease),
      cost,
      message,
      provokedErrors: refusalErrors(lines),
    };
  } finally {
    await gate.close();
    observation.stop();
  }
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
    scanned.push({ offset, verb: stillPicked ? orderVerb(browser.orderBar()) : null });
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

/** What the order bar offers after a tap: the order its row names, "short" when a cost of it is not covered, or null. */
function orderVerb(bar) {
  if (!bar) return null;
  return bar.short ? "short" : bar.verb;
}

async function waitUntil(check, timeoutMs) {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > timeoutMs) return false;
    await sleep(POLL_MS);
  }
  return true;
}

/** The neighbour's realm and army in the far-place game, each shared by a message with its chip. */
const FAR_PLACES = { structure: 8, army: 211 };
const farPlaceChip = (kind) =>
  `section[aria-label="${HUD_WORDS.chat}"] [data-place-key$="/${kind}:${FAR_PLACES[kind]}"] button`;
const FAR_PLACE_WAIT_MS = 20_000;

/**
 * What a far place's press and its visit's Leave are read by: the scopes the lab's Herald served (its record), whether
 * the place's chip is there to press, and the map's selection.
 */
const farPlaceReading = (kind) => `JSON.stringify({
  chip: Boolean(document.querySelector(${JSON.stringify(farPlaceChip(kind))})),
  scopes: window.__labChain?.scopes ?? [],
  selection: {
    structure: window.__eternumMapSelection?.structure ?? null,
    army: window.__eternumMapSelection?.army ?? null,
    hex: window.__eternumMapSelection?.hex ?? null,
    camera: window.__eternumMapSelection?.camera ?? null,
  },
})`;

/** Where the selected place stands: a structure's selected tile, an army's own tile. */
const placeHex = (kind, selection) => (kind === "army" ? selection.army?.hex : selection.hex) ?? null;
const placeSelected = (kind, selection) =>
  selection[kind]?.id === FAR_PLACES[kind] && placeHex(kind, selection) !== null;

/**
 * Chat opened as a player opens it where its message is not shown (the desktop's strip, a phone's Chat place), then the
 * shared place's chip pressed, until the map has it selected.
 */
function openTheFarPlace(kind) {
  return async ({ browser }) => {
    if (!browser.read(farPlaceReading(kind)).chip) {
      if (onADesktop()) browser.click(`${HUD_WORDS.chat} strip`);
      else browser.tapPlace(HUD_WORDS.chat);
      await sleep(1_500);
    }
    const before = browser.read(farPlaceReading(kind));
    if (!before.chip) return { before, after: null };
    browser.run(["click", farPlaceChip(kind)]);
    const startedAt = Date.now();
    let after = browser.read(farPlaceReading(kind));
    while (!placeSelected(kind, after.selection) && Date.now() - startedAt < FAR_PLACE_WAIT_MS) {
      await sleep(POLL_MS);
      after = browser.read(farPlaceReading(kind));
    }
    return { before, after };
  };
}

/**
 * The far place opened as the stream brings it: out of the player's scope before the press, a visit of its owner's
 * served after it carrying it, and the map with it selected where it stands, the camera on it.
 */
export function openedTheFarPlace(kind) {
  return ({ seen, played }) => {
    // A visit's banner stands in a phone's place bar, so no place is lit: the route and the drawn scene are the map.
    if (seen.scene !== "map" || seen.rendered !== "map")
      return failed(
        `expected the map, saw the route on ${seen.scene ?? "no scene"}, ${seen.rendered ?? "no scene"} drawn`,
      );
    if (!played.after) return failed("the message's place was not there to press", played);
    const carried = (scope) => (kind === "army" ? scope.armies : scope.structures).includes(FAR_PLACES[kind]);
    // The scope the stream followed as the chip was pressed, then the ones served after the press.
    const atPress = played.before.scopes.at(-1);
    if (!atPress || atPress.visit !== null || carried(atPress))
      return blocked("the place was in view before the press: nothing out of view to open", played);
    const served = played.after.scopes.slice(played.before.scopes.length);
    if (!served.some((scope) => scope.visit !== null && carried(scope)))
      return failed("no visit brought the place into the stream", played);
    const { selection } = played.after;
    if (selection[kind]?.id !== FAR_PLACES[kind]) return failed(`the ${kind} was not selected`, played);
    const hex = placeHex(kind, selection);
    if (!hex) return failed(`the selected ${kind} stands nowhere on the map`, played);
    if (selection.camera?.col !== hex.col || selection.camera?.row !== hex.row)
      return failed(`the camera is not on the ${kind}`, played);
    return completed(played);
  };
}

/** The visit's Leave pressed as the visit steps press it, then the scopes the stream was served once it left. */
async function leaveTheFarVisit(input) {
  const played = await leaveTheVisit(input);
  const startedAt = Date.now();
  let scopes = input.browser.read(farPlaceReading("structure")).scopes;
  while (scopes.at(-1)?.visit !== null && Date.now() - startedAt < FAR_PLACE_WAIT_MS) {
    await sleep(POLL_MS);
    scopes = input.browser.read(farPlaceReading("structure")).scopes;
  }
  return { ...played, scopes };
}

/**
 * Left for home: the stream served the player's own scope again, without the visited realm and its army, and the
 * player's realm, its board and HUD back as the season board's visit leaves (homeAgain).
 */
export function leftForHome({ seen, played }) {
  const last = played.scopes.at(-1);
  if (!last || last.visit !== null) return failed("the stream still follows the visit", played);
  if (last.structures.includes(FAR_PLACES.structure) || last.armies.includes(FAR_PLACES.army))
    return failed("the visited realm or its army stayed in the stream", played);
  return homeAgain({ seen, played });
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
