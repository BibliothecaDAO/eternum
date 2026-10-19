import { describe, expect, it } from "vitest";

import { WORLDMAP_CAMERA_ZOOM } from "../../src/three/scenes/worldmap-camera-view-profile";
import { CLOSEST_CAMERA_DISTANCE, SPECTATOR_STEPS, STEP_SETS } from "./steps.mjs";

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

describe("a scene check", () => {
  const verify = verifyOf("open-map");

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
  const ordered = (played, { confirmed = true, tile = played.after?.hex ?? null } = {}) => ({
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
  });

  it("completes an order whose army stayed selected through it and is offered orders from where it went", () => {
    const verdict = blitzStep("order-kept")(ordered({ after: army(moved, 5) }));
    expect(verdict).toMatchObject({ status: "completed", before: army(home, 6), after: army(moved, 5) });
    expect(verdict.orders.commands).toEqual([{ kind: "move", hash: "0x1", confirmed: true }]);
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
