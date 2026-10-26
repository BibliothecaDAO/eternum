import { describe, expect, it, vi } from "vitest";

import { WORLDMAP_CAMERA_ZOOM } from "../../src/three/scenes/worldmap-camera-view-profile";
import { ARMY_PLATE_HEIGHT } from "../../src/three/constants/army-constants";
import { ARMY_LABEL_POINT } from "./plates.mjs";
import { CLOSEST_CAMERA_DISTANCE, FARTHEST_CAMERA_DISTANCE, SPECTATOR_STEPS, STEP_SETS } from "./steps.mjs";

const onTheMap = { scene: "map", rendered: "map", place: "Map", dialogs: [], pressed: [] };
const verifyOf = (name) => SPECTATOR_STEPS.find((step) => step.name === name).verify;

describe("the zoom step", () => {
  const verify = verifyOf("zoom");

  it("completes when the camera distance grew from where it was, then shrank", () => {
    expect(verify({ seen: onTheMap, played: { before: 20, zoomedOut: 45, zoomedIn: 11.86 } }).status).toBe("completed");
  });

  it("fails a zoom out that did nothing, even when the zoom in moved", () => {
    expect(verify({ seen: onTheMap, played: { before: 20, zoomedOut: 20, zoomedIn: 10 } }).status).toBe("failed");
  });

  it("fails when the starting distance was never read", () => {
    expect(verify({ seen: onTheMap, played: { before: null, zoomedOut: 45, zoomedIn: 11 } }).status).toBe("failed");
  });

  it("fails off the map, whatever the distances", () => {
    const onTheRealm = { ...onTheMap, scene: "hex", rendered: "hex", place: "Realm" };
    expect(verify({ seen: onTheRealm, played: { before: 20, zoomedOut: 45, zoomedIn: 11 } }).status).toBe("failed");
  });
});

describe("the Blitz spectator's zoom", () => {
  const verify = STEP_SETS["blitz-spectator"].steps.find((step) => step.name === "zoom").verify;
  const blitzMap = { scene: "map", rendered: "map", place: null, dialogs: [], pressed: [] };

  it("completes on the drawn world map, which lights no place", () => {
    expect(verify({ seen: blitzMap, played: { before: 20, zoomedOut: 45, zoomedIn: 11 } }).status).toBe("completed");
  });

  it("fails with the realm's tiles drawn", () => {
    const local = { ...blitzMap, scene: "hex", rendered: "hex" };
    expect(verify({ seen: local, played: { before: 20, zoomedOut: 45, zoomedIn: 11 } }).status).toBe("failed");
  });
});

describe("the still map's zoom to the closest view", () => {
  const verify = STEP_SETS["still-map"].steps.find((step) => step.name === "zoom-in").verify;

  it("is the map's own closest distance", () => {
    expect(CLOSEST_CAMERA_DISTANCE).toBe(WORLDMAP_CAMERA_ZOOM.minDistance);
  });

  it("has a farthest view the plates read too: the map's own farthest distance", () => {
    expect(FARTHEST_CAMERA_DISTANCE).toBe(WORLDMAP_CAMERA_ZOOM.maxDistance);
    const out = STEP_SETS["frontier-plates"].steps.find((step) => step.name === "zoom-out").verify;
    expect(out({ seen: onTheMap, played: { distance: 45 } }).status).toBe("completed");
    expect(out({ seen: onTheMap, played: { distance: 30 } }).reason).toBe(
      "the camera stopped at distance 30, not the farthest (45)",
    );
  });

  it("completes at the closest distance, including a camera that started there", () => {
    expect(verify({ seen: onTheMap, played: { distance: 10 } }).status).toBe("completed");
    expect(verify({ seen: onTheMap, played: { distance: 10.02 } }).status).toBe("completed");
  });

  it("fails a camera that stopped short of the closest view", () => {
    expect(verify({ seen: onTheMap, played: { distance: 45 } })).toMatchObject({
      status: "failed",
      reason: "the camera stopped at distance 45, not the closest (10)",
    });
    expect(verify({ seen: onTheMap, played: { distance: 10.5 } }).status).toBe("failed");
  });

  it("fails when no distance was read, or it is not a number", () => {
    for (const played of [{ distance: null }, { distance: Number.NaN }, { distance: Infinity }, {}, undefined]) {
      expect(verify({ seen: onTheMap, played }).status).toBe("failed");
    }
  });

  it("fails off the map, whatever the distance", () => {
    const onTheRealm = { ...onTheMap, scene: "hex", rendered: "hex", place: "Realm" };
    expect(verify({ seen: onTheRealm, played: { distance: 10 } }).status).toBe("failed");
  });
});

describe("the still map's frames", () => {
  const verify = STEP_SETS["still-map"].steps.find((step) => step.name === "still-close").verify;

  it("completes with enough frames on the map", () => {
    expect(verify({ seen: onTheMap, played: { frames: 180 } }).status).toBe("completed");
  });

  it("fails a recording that caught too few frames to compare", () => {
    expect(verify({ seen: onTheMap, played: { frames: 4 } })).toMatchObject({
      status: "failed",
      reason: expect.stringContaining("only 4 frames"),
    });
  });
});

describe("the Blitz realm load", () => {
  it("plays the realm-load steps on a live Blitz game, its realm found by the top bar's Realm tab", () => {
    const blitz = STEP_SETS["blitz-realm-load"];
    const names = (steps) => steps.map((step) => step.name);
    const firstRealm = blitz.steps.find((step) => step.name === "first-realm").verify;
    const onTheRealm = { scene: "hex", rendered: "hex", place: "Realm", dialogs: [], pressed: [] };

    expect(blitz.game.mode).toBe("blitz");
    expect(names(blitz.steps)).toEqual(names(STEP_SETS["realm-load"].steps));
    expect(firstRealm({ seen: onTheRealm }).status).toBe("completed");
    expect(firstRealm({ seen: { ...onTheRealm, rendered: "map" } }).status).toBe("failed");
  });
});

describe("the Blitz still map", () => {
  const blitzMap = { scene: "map", rendered: "map", place: null, dialogs: [], pressed: [] };
  const stepNames = (set) => STEP_SETS[set].steps.map((step) => step.name);

  it("opens the world map and holds the closest view to the same distance check, with no place bar to light", () => {
    const zoom = STEP_SETS["blitz-still-map"].steps.find((step) => step.name === "zoom-in").verify;
    expect(zoom({ seen: blitzMap, played: { distance: 10 } }).status).toBe("completed");
    expect(zoom({ seen: blitzMap, played: { distance: 20 } }).status).toBe("failed");
    expect(stepNames("blitz-still-map")).toEqual(["open-world", "still-medium", "zoom-in", "still-close"]);
  });

  it("holds the sun before it records, with the dev tools on", () => {
    expect(stepNames("blitz-still-map-frozen-sun")).toEqual([
      "open-world",
      "freeze-sun",
      "still-medium",
      "zoom-in",
      "still-close",
    ]);
    expect(STEP_SETS["blitz-still-map-frozen-sun"].devOverlays).toBe(true);
  });
});

describe("holding the sun", () => {
  const verify = STEP_SETS["still-map-frozen-sun"].steps.find((step) => step.name === "freeze-sun").verify;

  it("completes once Override Time is ticked, and fails a build whose dev tools do not offer it", () => {
    expect(verify({ seen: onTheMap, played: { held: true } }).status).toBe("completed");
    expect(verify({ seen: onTheMap, played: { held: false } })).toMatchObject({
      status: "failed",
      reason: "the dev tools offer no Override Time to hold the sun",
    });
  });

  it("is a step list that opens the dev tools, unlike the still map it otherwise repeats", () => {
    expect(STEP_SETS["still-map-frozen-sun"].devOverlays).toBe(true);
    expect(STEP_SETS["still-map"].devOverlays).toBeUndefined();
  });
});

describe("entering Frontier", () => {
  const verify = verifyOf("enter-on-map");

  it("completes on the world map, and fails a session that opens on the realm", () => {
    expect(verify({ seen: onTheMap }).status).toBe("completed");
    const onTheRealm = { ...onTheMap, scene: "hex", rendered: "hex", place: "Realm" };
    expect(verify({ seen: onTheRealm }).status).toBe("failed");
  });
});

describe("reading the season", () => {
  const verify = verifyOf("season");
  const seen = (panels, pressed = []) => ({ ...onTheMap, panels, pressed });
  const desktop = {
    desktop: true,
    opened: seen(["Realm", "Season"], ["Season"]),
    closed: seen(["Realm", "Feed"], ["Feed"]),
  };
  const phone = { desktop: false, menu: ["Menu"], opened: seen(["Season"]), closed: seen([]) };

  it("completes on a desktop when the Season place lit and its board drew in the rail, then closed", () => {
    expect(verify({ seen: onTheMap, played: desktop }).status).toBe("completed");
  });

  it("fails a desktop whose place stayed dark, whose board never drew, or whose board stayed", () => {
    const dark = { ...desktop, opened: seen(["Realm", "Season"]) };
    expect(verify({ seen: onTheMap, played: dark }).reason).toBe("the Season place was not lit");
    const empty = { ...desktop, opened: seen(["Realm", "Feed"], ["Season"]) };
    expect(verify({ seen: onTheMap, played: empty }).reason).toBe("the Season's board was not drawn");
    const stayed = { ...desktop, closed: seen(["Realm", "Season"]) };
    expect(verify({ seen: onTheMap, played: stayed }).reason).toBe("the Season's board did not close");
  });

  it("reads a phone's season from its Menu: the board drew, then its Back closed it", () => {
    expect(verify({ seen: onTheMap, played: phone }).status).toBe("completed");
    expect(verify({ seen: onTheMap, played: { ...phone, menu: [] } }).reason).toBe("no Menu sheet opened");
    expect(verify({ seen: onTheMap, played: { ...phone, opened: seen([]) } }).reason).toBe(
      "the Season's board was not drawn",
    );
    expect(verify({ seen: onTheMap, played: { ...phone, closed: seen(["Season"]) } }).reason).toBe(
      "the Season's board did not close",
    );
  });
});

describe("a story opened from the Feed", () => {
  const verify = verifyOf("open-feed-event");
  const to = { col: -1446133336, row: -1596959636 };
  // The selected tile is a contract hex: the address's, one map centre (1,596,960,486) out on both axes.
  const tile = { col: 150827150, row: 850 };
  const selected = { ...onTheMap, selection: { hex: tile, camera: tile } };
  const played = { row: "12:31 A fight · Guard holds", to, reloaded: false };

  it("completes on the map at the story's place, selected, in the same page", () => {
    expect(verify({ seen: selected, played }).status).toBe("completed");
  });

  it("fails a phone whose Log never opened, and is blocked only when an opened Feed holds no story", () => {
    expect(verify({ seen: selected, played: { log: false, row: null } }).reason).toBe("the Log did not open");
    expect(verify({ seen: selected, played: { log: true, row: null } }).status).toBe("blocked");
    expect(verify({ seen: selected, played: { ...played, log: true } }).status).toBe("completed");
  });

  it("fails a page that loaded again, a place not selected, another tile selected, or the camera elsewhere", () => {
    expect(verify({ seen: selected, played: { ...played, reloaded: true } }).reason).toBe(
      "the page loaded again to open the story",
    );
    expect(verify({ seen: onTheMap, played }).reason).toBe("the story's place: nothing was selected");
    const elsewhere = { ...onTheMap, selection: { hex: { col: 150827151, row: 850 }, camera: tile } };
    expect(verify({ seen: elsewhere, played }).status).toBe("failed");
    const lookingAway = { ...onTheMap, selection: { hex: tile, camera: { col: 150826822, row: 850 } } };
    expect(verify({ seen: lookingAway, played }).reason).toBe(
      'the story\'s place: the camera looks at {"col":150826822,"row":850}, not the selected tile {"col":150827150,"row":850}',
    );
  });

  it("is blocked when the Feed shows no story", () => {
    expect(verify({ seen: onTheMap, played: { row: null } }).status).toBe("blocked");
  });
});

describe("visiting other realms", () => {
  const verify = verifyOf("visit-realm");
  const site = { col: -1446133336, row: -1596959636 };
  const tile = { col: 150827150, row: 850 };
  const theirs = { id: 1508272, owner: "0x2", realm: true, ownedByViewer: false };
  const onTheRealm = { ...onTheMap, selection: { hex: tile, camera: tile, structure: theirs } };
  const visit = {
    row: "#2 clientlane",
    realm: true,
    map: true,
    realmHex: site,
    mapHex: site,
    reloaded: false,
    seen: onTheRealm,
  };
  const twoVisits = (second) => ({ visits: [visit, { ...visit, row: "#4 djizus", ...second }] });

  it("completes when each realm and then the map on it opened in the same page, it selected and in view", () => {
    expect(verify({ seen: onTheRealm, played: twoVisits({}) }).status).toBe("completed");
  });

  it("fails a later visit whose map selected another realm or nothing, or looks elsewhere", () => {
    const own = {
      ...onTheRealm,
      selection: { ...onTheRealm.selection, structure: { ...theirs, ownedByViewer: true } },
    };
    expect(verify({ seen: own, played: twoVisits({ seen: own }) }).reason).toBe(
      "visit 2 (#4 djizus): it is not the realm selected",
    );
    expect(verify({ seen: onTheMap, played: twoVisits({ seen: onTheMap }) }).reason).toBe(
      "visit 2 (#4 djizus): it is not the realm selected",
    );
    const away = { ...onTheRealm, selection: { ...onTheRealm.selection, camera: { col: 97316650, row: 850 } } };
    expect(verify({ seen: away, played: twoVisits({ seen: away }) }).status).toBe("failed");
  });

  it("fails a visit that loaded the page again or opened the map elsewhere", () => {
    expect(verify({ seen: onTheRealm, played: twoVisits({ reloaded: true }) }).reason).toBe(
      "visit 2 (#4 djizus): the page loaded again",
    );
    const elsewhere = twoVisits({ mapHex: { col: site.col + 1, row: site.row } });
    expect(verify({ seen: onTheRealm, played: elsewhere }).status).toBe("failed");
    expect(verify({ seen: onTheRealm, played: twoVisits({ map: false }) }).reason).toBe(
      "visit 2 (#4 djizus): the map never opened on it",
    );
  });

  it("is blocked when the board lists no other realm", () => {
    expect(verify({ seen: onTheMap, played: { visits: [{ row: null }] } }).status).toBe("blocked");
  });
});

describe("a scene check", () => {
  const verify = verifyOf("return-to-map");

  it("fails a route on the map with Map lit while the realm is still drawn", () => {
    const realmDrawnUnderTheMapRoute = { ...onTheMap, rendered: "hex" };
    expect(verify({ seen: realmDrawnUnderTheMapRoute })).toMatchObject({
      status: "failed",
      reason: expect.stringContaining("hex drawn"),
    });
  });
});

describe("the ownership-ring steps", () => {
  const ringStep = (name) => STEP_SETS["ownership-rings"].steps.find((step) => step.name === name).verify;
  const ownRealm = { id: 1, owner: "0xa11ce", realm: true, ownedByViewer: true };
  const selected = (structure, ringedHexes) => ({
    ...onTheMap,
    selection: { hex: { col: 4, row: 5 }, structure, ringedHexes },
  });
  const nothing = { ...onTheMap, selection: { hex: null, structure: null, ringedHexes: 0 } };

  it("completes a selected phase only on the player's own realm with its holdings ringed, keeping the ring count", () => {
    expect(ringStep("select-realm")({ seen: selected(ownRealm, 4) })).toEqual({
      status: "completed",
      selection: { hex: { col: 4, row: 5 }, structure: ownRealm, ringedHexes: 4 },
    });
    expect(ringStep("selected-idle")({ seen: selected(ownRealm, 4) }).status).toBe("completed");
  });

  it("fails a tap that selected nothing, the wrong entity, or a realm whose holdings are not ringed", () => {
    const verify = ringStep("select-realm");
    expect(verify({ seen: nothing }).reason).toBe("no structure is selected (hex null)");
    expect(verify({ seen: selected({ ...ownRealm, id: 9, ownedByViewer: false }, 2) }).reason).toBe(
      "structure 9 is selected, not the player's own realm",
    );
    expect(verify({ seen: selected({ ...ownRealm, id: 8, realm: false }, 2) }).status).toBe("failed");
    expect(verify({ seen: selected(ownRealm, 0) }).reason).toBe("the selected realm's holdings are not ringed");
  });

  it("fails an unselected phase that still holds a selection or rings, and completes a clear one", () => {
    expect(ringStep("cleared-idle")({ seen: selected(ownRealm, 4) }).reason).toBe(
      "the map still holds a selection or rings",
    );
    expect(
      ringStep("unselected-idle")({ seen: { ...nothing, selection: { ...nothing.selection, ringedHexes: 1 } } }).status,
    ).toBe("failed");
    expect(ringStep("unselected-idle")({ seen: nothing }).status).toBe("completed");
  });

  it("fails every selection phase on a page that does not report its selection", () => {
    for (const name of ["unselected-idle", "select-realm", "selected-idle", "cleared-idle"]) {
      expect(ringStep(name)({ seen: { ...onTheMap, selection: null } }).status).toBe("failed");
    }
  });
});

describe("the Blitz order steps", () => {
  const blitzStep = (name) => STEP_SETS["blitz-orders"].steps.find((step) => step.name === name).verify;
  const army = (hex, orders) => ({ id: 7, hex, orders });
  const home = { col: 10, row: 10 };
  const moved = { col: 11, row: 10 };
  const window = { from: 0, to: 100 };
  // The army trace of one move: requested, sent with its hash, and confirmed unless the node refused it.
  const traceOfOneMove = ({ confirmed }) => ({
    armyMovement: [
      { phase: "move_requested", entityId: 7, wallTimeMs: 10 },
      { phase: "tx_submitted", entityId: 7, wallTimeMs: 20, txHash: "0x1" },
      ...(confirmed ? [{ phase: "tx_confirmed", entityId: 7, wallTimeMs: 40 }] : []),
    ],
  });
  // The tile panel's hex follows the selected army unless a case says where it stayed.
  // The probe's readings of the selected army's plate through the step: [page time, stamina].
  const ordered = (played, { confirmed = true, tile = played.after?.hex ?? null, plateStamina = [] } = {}) => ({
    seen: { ...onTheMap, selection: { hex: tile, structure: null, ringedHexes: 0, army: played.after ?? null } },
    played: {
      before: army(home, 6),
      target: { offset: [137, 0], verb: "Move" },
      scanned: [],
      sent: true,
      inFlight: army(home, 0),
      ...played,
    },
    actionLatency: traceOfOneMove({ confirmed }),
    window,
    probe: { plateStamina },
  });

  it("completes an order whose army stayed selected through it and is offered orders from where it went", () => {
    const verdict = blitzStep("order-kept")(ordered({ after: army(moved, 5) }));
    expect(verdict).toMatchObject({ status: "completed", before: army(home, 6), after: army(moved, 5) });
    expect(verdict.orders.commands).toEqual([{ kind: "move", hash: "0x1", confirmed: true }]);
  });

  it("fails an order whose army's plate climbed back to an older bar while it walked", () => {
    // A walk that redraws the plate from a stale record: 13, then 22 (a bar it had before), then 3.
    const staleWalk = [
      [10, 13],
      [30, 22],
      [50, 3],
    ];
    expect(blitzStep("order-kept")(ordered({ after: army(moved, 5) }, { plateStamina: staleWalk })).reason).toBe(
      "the army's plate read 13 stamina, then 22: a bar it no longer has",
    );
    const paidThenRegenerating = [
      [10, 13],
      [30, 3],
      [50, 4],
    ];
    expect(
      blitzStep("order-kept")(ordered({ after: army(moved, 5) }, { plateStamina: paidThenRegenerating })).status,
    ).toBe("completed");
  });

  it("fails an order that handed the selection away, at the send or at the outcome", () => {
    expect(blitzStep("order-kept")(ordered({ after: null })).reason).toBe(
      "the army was not selected after its order's outcome",
    );
    expect(blitzStep("order-kept")(ordered({ inFlight: null, after: army(moved, 5) })).reason).toBe(
      "the army was not selected while its order was in flight",
    );
    expect(blitzStep("second-order")(ordered({ before: null })).reason).toBe(
      "no army was selected when the step began: the step before left none selected",
    );
  });

  it("fails an order offered nothing from its new tile, or offered orders where it stood, or never confirmed", () => {
    expect(blitzStep("order-kept")(ordered({ after: army(moved, 0) })).reason).toBe(
      "the army was offered no orders after its outcome",
    );
    expect(blitzStep("order-kept")(ordered({ after: army(home, 6) })).reason).toBe(
      "the army is not offered orders from the tile its order took it to",
    );
    expect(blitzStep("order-kept")(ordered({ after: army(moved, 5) }, { confirmed: false })).reason).toBe(
      "0 orders were sent and confirmed, not 1",
    );
  });

  it("fails an order whose army stayed selected while the tile panel stayed on the tile it left", () => {
    expect(blitzStep("order-kept")(ordered({ after: army(moved, 5) }, { tile: home })).reason).toBe(
      "the tile panel names (10, 10), not the selected army's tile (11, 10)",
    );
    expect(blitzStep("order-kept")(ordered({ after: army(moved, 5) }, { tile: null })).reason).toBe(
      "the tile panel names no tile, not the selected army's tile (11, 10)",
    );
    expect(
      blitzStep("order-refused")(ordered({ after: army(home, 6) }, { confirmed: false, tile: moved })).reason,
    ).toBe("the tile panel names (11, 10), not the selected army's tile (10, 10)");
  });

  it("completes an explore that leaves the army where it stood, and fails a move that does", () => {
    const explore = { target: { offset: [137, 0], verb: "Explore" } };
    expect(blitzStep("order-kept")(ordered({ ...explore, after: army(home, 4) })).status).toBe("completed");
    expect(blitzStep("order-kept")(ordered({ after: army(home, 4) })).reason).toBe(
      "the army is not offered orders from the tile its order took it to",
    );
  });

  it("fails each order step whose last report is missing, has no army, or another army selected", () => {
    const withSelection = (step, played, selection, options) => {
      const input = ordered(played, options);
      return blitzStep(step)({ ...input, seen: { ...input.seen, selection } });
    };
    const cases = [
      ["order-kept", { after: army(moved, 5) }, {}],
      ["second-order", { after: army(moved, 5) }, {}],
      ["order-refused", { after: army(home, 6) }, { confirmed: false }],
    ];
    for (const [step, played, options] of cases) {
      const tile = played.after.hex;
      expect(withSelection(step, played, undefined, options).reason).toBe(
        "the page reported no map selection after the step",
      );
      expect(withSelection(step, played, { hex: tile, army: null }, options).reason).toBe(
        "the page's last report has no army selected, not army 7",
      );
      expect(withSelection(step, played, { hex: tile, army: { id: 8, hex: tile, orders: 5 } }, options).reason).toBe(
        "the page's last report has army 8 selected, not army 7",
      );
    }
  });

  it("is blocked, not passed, when no tile around the army offers it a move or an explore", () => {
    expect(
      blitzStep("order-kept")(ordered({ target: null, scanned: [{ verb: "Attack" }, { verb: null }] })),
    ).toMatchObject({ status: "blocked", reason: expect.stringContaining("Attack, nothing") });
  });

  it("completes a refusal only with the army still selected where it stood and offered its orders again", () => {
    const refused = (after) => blitzStep("order-refused")(ordered({ after }, { confirmed: false }));
    expect(refused(army(home, 6)).status).toBe("completed");
    expect(refused(null).reason).toBe("the army was not selected after its order was refused");
    expect(refused(army(moved, 5)).reason).toBe("the army moved on a refused order");
    expect(refused(army(home, 0)).reason).toBe("the army was offered no orders after the refusal");
  });

  it("completes a deselection in flight only when the army stays unselected once its order is confirmed", () => {
    const verify = blitzStep("deselect-in-flight");
    expect(verify(ordered({ escapes: 2, deselected: true })).status).toBe("completed");
    const selectedAgain = ordered({ escapes: 2, deselected: true });
    selectedAgain.seen.selection.army = army(moved, 5);
    expect(verify(selectedAgain).reason).toBe("the army was selected again at its order's outcome");
    expect(verify(ordered({ escapes: 3, deselected: false })).reason).toBe(
      "3 Escapes left the army selected while its order was in flight",
    );
  });

  it("is blocked when Tab selects no army, and fails on a page that does not report its selection", () => {
    const verify = blitzStep("select-army");
    const reporting = { ...onTheMap, selection: { hex: null, structure: null, ringedHexes: 0, army: null } };
    expect(verify({ seen: reporting, played: { army: null } }).status).toBe("blocked");
    expect(verify({ seen: reporting, played: { army: army(home, 6) } }).status).toBe("completed");
    expect(verify({ seen: { ...onTheMap, selection: null }, played: { army: army(home, 6) } }).status).toBe("failed");
  });
});

describe("the HUD's layout on the map", () => {
  const verify = verifyOf("hud-layout");
  const desktop = { width: 1280, height: 800 };
  // A Frontier desktop at 1280 by 800: the top bar's chip, the left column's strip, purse, armies and minimap, the
  // rail's events and chat, a round place at the foot.
  const parts = {
    "uxplay #12 Season": { left: 676, top: 4, right: 893, bottom: 40 },
    strip: { left: 12, top: 60, right: 332, bottom: 144 },
    "LORDS 1,240": { left: 220, top: 150, right: 324, bottom: 178 },
    Armies: { left: 12, top: 186, right: 332, bottom: 460 },
    Minimap: { left: 12, top: 468, right: 332, bottom: 780 },
    Events: { left: 948, top: 60, right: 1268, bottom: 110 },
    Research: { left: 560, top: 720, right: 610, bottom: 790 },
  };
  const minimap = parts.Minimap;
  const judged = (layout) =>
    verify({ seen: onTheMap, played: { layout: { viewport: desktop, minimap, covered: [], ...layout } } });

  it("completes with every part drawn whole on the page, none over another, every control reachable", () => {
    expect(judged({ parts }).status).toBe("completed");
  });

  it("fails a desktop with no minimap", () => {
    expect(judged({ parts, minimap: null }).reason).toBe("not drawn: the minimap");
  });

  it("fails a part pushed off the page, two parts over each other, or a control drawn over", () => {
    expect(judged({ parts: { ...parts, Minimap: { ...minimap, bottom: 820 } } }).reason).toBe("off the page: Minimap");
    expect(
      judged({ parts: { ...parts, "LORDS 1,240": { ...parts["LORDS 1,240"], top: 180, bottom: 210 } } }).reason,
    ).toBe("overlapping: LORDS 1,240 over Armies");
    expect(judged({ parts, covered: ["Research: Research"] }).reason).toBe("covered controls: Research: Research");
  });

  it("fails a part whose content runs past its edge, naming it", () => {
    expect(judged({ parts, spilled: ["Realm"] }).reason).toBe("content past its edge: Realm");
  });

  it("fails a region holding more than seven parts, and holds one of seven", () => {
    expect(judged({ parts, regions: { holdings: 4, commands: 7 } }).status).toBe("completed");
    expect(judged({ parts, regions: { holdings: 4, commands: 8 } }).reason).toBe("more than seven parts: commands (8)");
  });

  it("fails off the map, however the HUD lies", () => {
    const onTheRealm = { ...onTheMap, scene: "hex", rendered: "hex", place: "Realm" };
    expect(
      verify({ seen: onTheRealm, played: { layout: { viewport: desktop, parts, minimap, covered: [] } } }).status,
    ).toBe("failed");
  });
});

describe("the plate steps (a live Blitz's map plates, read as drawn)", () => {
  const verify = STEP_SETS["blitz-plates"].steps.find((step) => step.name === "plates-hovered").verify;
  const sides = { own: "rgb(102, 221, 171)", ally: "rgb(106, 168, 255)", enemy: "rgb(255, 123, 107)" };
  const clear = { labels: 34, opened: 1, tokens: 33, orderLine: null, overlaps: [], crowded: [], sides, things: [] };

  it("completes when no reading holds a token, plate or order line over or crowding another", () => {
    const played = {
      readings: [
        { offset: [65, -95], seen: clear },
        { offset: [137, 0], seen: clear },
      ],
    };
    expect(verify({ played }).status).toBe("completed");
  });

  it("fails on the first reading where two overlap or crowd, naming the tile hovered", () => {
    const overlap = { ...clear, overlaps: [{ a: "djizus T1 1,501", b: "The Vanguard", gap: -12 }] };
    const crowded = { ...clear, crowded: [{ a: "Attack", b: "Tamsin T2 700", gap: 2 }] };
    expect(verify({ played: { readings: [{ offset: [137, 0], seen: overlap }] } })).toMatchObject({
      status: "failed",
      offset: [137, 0],
      reason: "1 pairs overlap",
    });
    expect(verify({ played: { readings: [{ offset: null, seen: crowded }] } }).reason).toBe(
      "1 pairs stand closer than 4px",
    );
  });

  it("fails an opened plate that does not cover the token drawn for its thing before it opened", () => {
    const token = { kind: "token", key: "army:5", open: false, text: "T3 600", x: 400, y: 500, w: 64, h: 46 };
    const before = { ...clear, things: [token] };
    // Its army as drawn: its model's top at y 560 and its label point at y 546, under the token's foot (546).
    const over = { tile: { x: 432, y: 600 }, top: { x: 432, y: 560 }, point: { x: 432, y: 546 } };
    const plate = (x, y) => ({
      kind: "plate",
      key: "army:5",
      open: true,
      text: "Lord 3f2a",
      x,
      y,
      w: 174,
      h: 80,
      over,
    });
    // Over the token: its middle (432, 523) under the plate.
    const inPlace = { ...clear, things: [plate(345, 466)] };
    expect(verify({ played: { before, readings: [{ offset: null, seen: inPlace }] } }).status).toBe("completed");
    // 52px above it (the reviewer's crowded case): the token's middle is below the plate.
    const far = { ...clear, things: [plate(345, 414)] };
    expect(verify({ played: { before, readings: [{ offset: null, seen: far }] } }).reason).toBe(
      "1 opened plates stand away from their thing's token",
    );
  });

  it("measures an army against its own label point", () => {
    expect(ARMY_LABEL_POINT).toBe(ARMY_PLATE_HEIGHT);
  });

  it("fails a label that reaches down onto its thing, or stands beside it, as the renderer places the thing", () => {
    // An army's tile at (420, 560) on screen, its tallest model's top at (432, 520) and its label point at (434, 514),
    // leaning right as drawn.
    const over = { tile: { x: 420, y: 560 }, top: { x: 432, y: 520 }, point: { x: 434, y: 514 } };
    const token = (x, y) => ({ kind: "token", key: "army:5", open: false, text: "T1 1,500", x, y, w: 64, h: 50, over });
    const reading = (thing) => ({ played: { readings: [{ offset: null, seen: { ...clear, things: [thing] } }] } });
    // Its foot on the label point, 6px over the model's top, across it: above it.
    expect(verify(reading(token(400, 464))).status).toBe("completed");
    // Centred on that point (owner-army-label-on.png): its lower half over the army.
    expect(verify(reading(token(400, 489))).reason).toBe("1 labels stand on their thing or away from it");
    // A step aside (owner-camp-label-zoomout.png): its span no longer over the thing.
    expect(verify(reading(token(470, 464))).reason).toBe("1 labels stand on their thing or away from it");
    // A narrow token at a screen's edge, where the thing leans far: on its label point, past the top's x, still over it.
    const leaning = { tile: { x: 1595, y: 329 }, top: { x: 1699, y: 172 }, point: { x: 1716, y: 146 } };
    expect(verify(reading({ ...token(1701, 116), w: 30, h: 30, over: leaning })).status).toBe("completed");
  });

  it("fails a reading where a label takes pointer input, or a click at a label lands on it", () => {
    const reading = (seen) => ({ played: { readings: [{ offset: null, seen: { ...clear, ...seen } }] } });
    expect(verify(reading({ takers: 0, caught: [] })).status).toBe("completed");
    expect(verify(reading({ takers: 2, caught: [] })).reason).toBe(
      "labels take pointer input: 2 elements, a click caught on 0",
    );
    expect(verify(reading({ takers: 0, caught: ["T1 500"] })).reason).toBe(
      "labels take pointer input: 0 elements, a click caught on 1",
    );
  });

  it("clicks each label, token or plate, and the same point with the labels hidden: labels never take a click", async () => {
    // The owner, 2026-10-20: "I wanna remove the clicking the label select the structure/army [...] we click the tile
    // and that's it". A token's thing is measured (`over`), but its click must still land on the tile under the pointer.
    const step = STEP_SETS["frontier-plates"].steps.find((one) => one.name === "labels-click-through-far");
    const token = { kind: "token", text: "T1 500", x: 950, y: 480, w: 60, h: 40, over: { tile: { x: 980, y: 600 } } };
    const plate = { kind: "plate", text: "Own B", x: 1100, y: 300, w: 180, h: 80 };
    const line = { kind: "order line", text: "Attack", x: 700, y: 700, w: 90, h: 50 };
    const taps = [];
    const hidden = [];
    let layer = "";
    const browser = {
      read: (expression) =>
        expression === "JSON.stringify({ width: innerWidth, height: innerHeight })"
          ? { width: 1920, height: 1080 }
          : { things: [token, plate, line] },
      run: ([, script]) => {
        layer = script.includes('"hidden"') ? "hidden" : "";
      },
      press: () => undefined,
      tap: (offset) => {
        taps.push(offset);
        hidden.push(layer === "hidden");
      },
      observe: () => ({ selection: { hex: { col: 4, row: 7 } } }),
    };
    vi.useFakeTimers();
    try {
      const playing = step.play({ browser, extraScreenshot: () => undefined });
      await vi.runAllTimersAsync();
      const played = await playing;
      // The token's middle (980, 500) and the plate's (1190, 340), each clicked shown then hidden; the order line never.
      expect(taps).toEqual([
        [20, -40],
        [20, -40],
        [230, -200],
        [230, -200],
      ]);
      expect(hidden).toEqual([false, true, false, true]);
      expect(played.clicks.map((click) => [click.kind, click.at])).toEqual([
        ["token", [20, -40]],
        ["plate", [230, -200]],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails any click at a label that selected another tile than the same click with the labels hidden", () => {
    const click = STEP_SETS["frontier-plates"].steps.find((step) => step.name === "labels-click-through-far").verify;
    const hex = (col, row) => ({ col, row });
    const token = { label: "T1 500", kind: "token", at: [10, -40], shown: hex(4, 7), expected: hex(4, 7) };
    const plate = { label: "Own B", kind: "plate", at: [60, -40], shown: hex(5, 6), expected: hex(5, 6) };
    expect(click({ played: { clicks: [token, plate] } }).status).toBe("completed");
    // The token's click selected its own thing's tile, not the tile under the pointer.
    expect(click({ played: { clicks: [{ ...token, shown: hex(4, 6) }] } }).reason).toBe(
      "1 clicks at a label did not select the tile beneath it",
    );
    expect(click({ played: { clicks: [{ ...plate, shown: null }] } }).status).toBe("failed");
    expect(click({ played: { clicks: [] } }).status).toBe("blocked");
  });

  it("calls a page that does not report its world blocked: its labels were not measured against their things", () => {
    const token = {
      kind: "token",
      key: "army:5",
      open: false,
      text: "T3 600",
      x: 400,
      y: 500,
      w: 64,
      h: 46,
      over: null,
    };
    const seen = { ...clear, world: false, things: [token] };
    expect(verify({ played: { readings: [{ offset: null, seen }] } }).status).toBe("blocked");
  });

  it("calls a view with no label drawn blocked: an empty map proves nothing either way", () => {
    const empty = { ...clear, labels: 0, opened: 0, tokens: 0 };
    expect(verify({ played: { readings: [{ offset: null, seen: empty }] } }).status).toBe("blocked");
  });

  it("takes the readiest army first only in a seated player's list", () => {
    const names = (set) => STEP_SETS[set].steps.map((step) => step.name);
    expect(names("blitz-plates")).not.toContain("select-army");
    expect(names("blitz-plates-player").slice(0, 2)).toEqual(["open-world", "select-army"]);
    // A Frontier session enters on the world map, as a player's does.
    expect(names("frontier-plates").slice(0, 2)).toEqual(["enter-on-map", "plates"]);
    expect(names("frontier-plates")).toEqual(expect.arrayContaining(["zoom-out", "plates-far", "plates-far-hovered"]));
    // Each opens the page with the dev overlays: the page then reports its world, and every label is measured.
    for (const set of ["blitz-plates", "blitz-plates-player", "frontier-plates", "frontier-plates-player"])
      expect(STEP_SETS[set].devOverlays).toBe(true);
    expect(names("frontier-plates-player").slice(0, 2)).toEqual(["enter-on-map", "select-army"]);
  });
});

describe("the player's Wheat store card", () => {
  const verify = STEP_SETS.player.steps.find((step) => step.name === "wheat-store").verify;

  it("requires the card to open and close through its store control", () => {
    expect(verify({ played: { opened: true, closed: false } }).status).toBe("completed");
    expect(verify({ played: { opened: false, closed: false } }).status).toBe("failed");
    expect(verify({ played: { opened: true, closed: true } }).status).toBe("failed");
  });
});
