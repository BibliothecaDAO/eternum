import { describe, expect, it } from "vitest";

import { PerspectiveCamera, Vector3 } from "three";

import { ARMY_PLATE_HEIGHT } from "../constants/army-constants";
import {
  WORLDMAP_CAMERA_ZOOM,
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../scenes/worldmap-camera-view-profile";
import { latticeToWorld } from "../utils/hex-lattice";
import { inPlaceOf, placePlates, type PlateSpot, type PlateThing, type Rect } from "./map-plate-layout";

const SCREEN: { width: number; height: number; columns: Rect[]; top: number } = {
  width: 1920,
  height: 1080,
  columns: [],
  top: 56,
};
const TOKEN = { width: 64, height: 46 };
const OPEN = { width: 180, height: 78 };
/**
 * Sizes as the lab draws them at 1920×1080, read off the page by plate-icons-4's drive: an army's token (its stamina bar
 * under its count) and a camp's (its holding beside its count); an army's plate opened (player | home, troops, stamina)
 * and a camp's (owner, name, guard | holding); the order line "Attack / 30 stamina".
 */
const DRAWN = {
  armyToken: { width: 74, height: 50 },
  campToken: { width: 112, height: 46 },
  armyPlate: { width: 176, height: 80 },
  campPlate: { width: 178, height: 80 },
  line: { width: 89, height: 52 },
};

const thing = (id: string, x: number, y: number, priority: number, fields: Partial<PlateThing> = {}): PlateThing => ({
  id,
  at: { x, y },
  token: TOKEN,
  priority,
  ...fields,
});

/** What is drawn, as rectangles: tokens and opened plates at their size; nothing for a stepped-aside or absent one. */
const drawn = (things: readonly PlateThing[], spots: Map<string, PlateSpot>): (Rect & { id: string })[] =>
  things.flatMap((one) => {
    const spot = spots.get(one.id)!;
    if (spot.shape === "none" || (spot.shape === "token" && spot.yields)) return [];
    const size = spot.shape === "plate" ? one.opened! : one.token;
    return [{ id: one.id, x: spot.x, y: spot.y, ...size }];
  });

/** The narrowest space between two drawn rectangles; negative where they overlap. */
const gap = (a: Rect, b: Rect) =>
  Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), b.y - (a.y + a.height), a.y - (b.y + b.height));

const narrowest = (rects: readonly Rect[]) =>
  Math.min(...rects.flatMap((a, i) => rects.slice(i + 1).map((b) => gap(a, b))));

/** A drawn token stands on its thing's label point: its foot there, the point under it with 6px of token either side. */
const onItsPoint = (one: PlateThing, spot: PlateSpot | undefined) =>
  spot?.shape === "token" &&
  spot.y + one.token.height === one.at.y &&
  one.at.x >= spot.x + 6 &&
  one.at.x <= spot.x + one.token.width - 6;

/** The same things with nothing opened: what the map drew before the hover or the selection (an own army stays kept). */
const atRest = (things: readonly PlateThing[]) =>
  things.map((one) => ({ id: one.id, at: one.at, token: one.token, priority: one.priority, keep: one.keep }));

/** Each opened plate's rectangle beside the token drawn for its thing before anything opened. */
const openedBesideTheirTokens = (things: readonly PlateThing[], spots: Map<string, PlateSpot>, screen = SCREEN) => {
  const before = placePlates(atRest(things), screen).spots;
  return things.flatMap((one) => {
    const spot = spots.get(one.id)!;
    const token = before.get(one.id)!;
    if (spot.shape !== "plate" || token.shape !== "token") return [];
    return [
      { id: one.id, plate: { x: spot.x, y: spot.y, ...one.opened! }, token: { x: token.x, y: token.y, ...one.token } },
    ];
  });
};

/** Every opened plate covers its token as drawn, and nothing drawn overlaps or crowds another (the line included). */
const expectInPlaceAndClear = (
  things: readonly PlateThing[],
  placed: ReturnType<typeof placePlates>,
  {
    screen = SCREEN,
    opened,
    line,
  }: { screen?: typeof SCREEN; opened: number; line?: { width: number; height: number } },
) => {
  const measured = openedBesideTheirTokens(things, placed.spots, screen);
  expect(measured).toHaveLength(opened);
  for (const one of measured) expect(inPlaceOf(one.plate, one.token)).toBe(true);
  const rects = [
    ...drawn(things, placed.spots),
    ...(line && placed.orderLine ? [{ id: "line", ...placed.orderLine, ...line }] : []),
  ];
  expect(narrowest(rects)).toBeGreaterThanOrEqual(6);
  for (const rect of rects) {
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(screen.width);
    expect(rect.y).toBeGreaterThanOrEqual(screen.top);
    for (const column of screen.columns) expect(gap(rect, column)).toBeGreaterThanOrEqual(0);
  }
};

describe("where the map's labels stand (the owner's plan D, 2026-10-19: 'icons everywhere, full plate on hover')", () => {
  it("stands a thing's token on its label point, centred over it: above the thing, never on it", () => {
    const { spots } = placePlates([thing("a", 200, 300, 1)], SCREEN);
    expect(spots.get("a")).toEqual({ shape: "token", x: 168, y: 300 - 46, yields: false });
  });

  it("slides a crowded token aside only while its label point stays under it, else draws none", () => {
    // b's place is 50px from a's: slid 24px right it is clear of a, its point still 8px inside its left edge. c shares
    // a's point: no slide keeps it over its own thing and clear of a's token.
    const things = [thing("a", 200, 300, 3), thing("b", 250, 300, 2), thing("c", 200, 300, 1)];
    const { spots } = placePlates(things, SCREEN);
    expect(spots.get("a")).toMatchObject({ shape: "token", x: 168, y: 254 });
    expect(spots.get("b")).toMatchObject({ shape: "token", x: 242, y: 254 });
    expect(spots.get("c")).toEqual({ shape: "none" });
    // A wall of tokens over every place: not drawn.
    const wall = Array.from({ length: 9 }, (_, index) =>
      thing(`w${index}`, 130 + (index % 3) * 70, 230 + Math.floor(index / 3) * 70, 5),
    );
    const boxed = placePlates([...wall, thing("m", 200, 300, 0)], SCREEN).spots;
    expect(boxed.get("m")).toEqual({ shape: "none" });
  });

  it("keeps every drawn token at least 6px from every other, however crowded", () => {
    // A dense block, as a busy Blitz at gameplay zoom: things every 70px across and 50px down.
    const things = Array.from({ length: 120 }, (_, index) =>
      thing(
        `t${index}`,
        100 + (index % 12) * 70 + (Math.floor(index / 12) % 2) * 35,
        150 + Math.floor(index / 12) * 50,
        index % 7,
        { token: { width: 52 + (index % 5) * 8, height: 46 } },
      ),
    );
    const { spots } = placePlates(things, SCREEN);
    const shown = drawn(things, spots);
    // A third of the block is drawn: every token on its own point (the old layout drew 65, none on its point).
    expect(shown.length).toBeGreaterThanOrEqual(40);
    expect(narrowest(shown)).toBeGreaterThanOrEqual(6);
    // However crowded, each drawn token stands on its own thing's point.
    for (const one of things)
      if (spots.get(one.id)?.shape === "token") expect(onItsPoint(one, spots.get(one.id))).toBe(true);
  });

  it("never moves a resting token for a hover or a selection: what an opened plate covers steps aside", () => {
    // s between r above and q below: standing on its foot it covers r.
    const things = [
      thing("r", 200, 230, 2),
      thing("s", 200, 300, 1),
      thing("q", 200, 370, 0),
      thing("far", 600, 300, 0),
    ];
    const before = placePlates(things, SCREEN).spots;
    const opened = things.map((one) => (one.id === "s" ? { ...one, opened: OPEN, openRank: 1 } : one));
    const after = placePlates(opened, SCREEN).spots;
    // s opens in place of its token, growing up from its foot (its label point, 300), over r: r stays put and steps aside.
    expect(after.get("s")).toEqual({ shape: "plate", x: 110, y: 300 - 78 });
    expect(after.get("r")).toEqual({ ...before.get("r"), yields: true });
    expect(after.get("q")).toEqual(before.get("q"));
    expect(after.get("far")).toEqual(before.get("far"));
  });

  it("slides an opened plate off a neighbour's token where a step keeps both in view (qa-blitz-4 #4)", () => {
    // The retest's pair at drawn sizes: the player's two armies side by side, the first hovered (its plate "T1 500 ·
    // 41/120", 113 × 56); the second's token stood within the gap of where that plate opens in place.
    const plate = { width: 113, height: 56 };
    const things = [
      thing("hovered", 670, 337, 1, { token: DRAWN.armyToken, opened: plate, openRank: 1 }),
      thing("beside", 752, 372, 1, { token: DRAWN.armyToken }),
    ];
    const placed = placePlates(things, SCREEN);
    // The second army keeps its token, drawn where it rested.
    expect(placed.spots.get("beside")).toEqual({
      ...placePlates(atRest(things), SCREEN).spots.get("beside"),
      yields: false,
    });
    // The hovered plate still stands in its token's place, clear of its neighbour.
    expectInPlaceAndClear(things, placed, { opened: 1 });
  });

  describe("an opened plate replaces the token drawn for its thing (owner, 2026-10-19: 'why is the hover so far')", () => {
    it("stands on its token's foot, its middle over the token's", () => {
      const hovered = thing("army", 400, 500, 1, { opened: OPEN, openRank: 1 });
      const placed = placePlates([hovered], SCREEN);
      expect(placed.spots.get("army")).toEqual({ shape: "plate", x: 310, y: 500 - 78 });
      expectInPlaceAndClear([hovered], placed, { opened: 1 });
    });

    it("replaces a token that slid aside where it was drawn, not where its thing is", () => {
      // Two things 50px apart: the second's token was drawn slid 24px right of its point.
      const things = [thing("first", 400, 500, 2), thing("slid", 450, 500, 1)];
      const before = placePlates(things, SCREEN).spots.get("slid") as { x: number; y: number };
      expect(before.x).toBe(450 - 32 + 24);
      const opened = things.map((one) => (one.id === "slid" ? { ...one, opened: OPEN, openRank: 1 } : one));
      const placed = placePlates(opened, SCREEN);
      const after = placed.spots.get("slid") as { x: number; y: number };
      expect(after.y + OPEN.height).toBe(before.y + TOKEN.height);
      expectInPlaceAndClear(opened, placed, { opened: 1 });
    });

    it("keeps the hovered camp's plate and the order line apart, beside the selected army's resting token", () => {
      // The owner's pair at drawn sizes: the player's army selected (its token rests, ringed), the next tile's camp
      // hovered with the army's order line beside it.
      const things = [
        thing("army", 400, 500, 1, { token: DRAWN.armyToken, keep: true }),
        thing("camp", 490, 500, 1, { token: DRAWN.campToken, opened: DRAWN.campPlate, openRank: 1 }),
      ];
      const placed = placePlates(things, SCREEN, { at: { x: 490, y: 530 }, size: DRAWN.line });
      expect(placed.closed.size).toBe(0);
      expect(placed.orderLine).not.toBeNull();
      expect(placed.spots.get("army")).toMatchObject({ shape: "token", yields: false });
      expectInPlaceAndClear(things, placed, { opened: 1, line: DRAWN.line });
    });

    it("stays on screen at the screen's edge, still over its token", () => {
      for (const x of [24, 1896]) {
        const one = [thing("edge", x, 500, 1, { token: DRAWN.armyToken, opened: DRAWN.armyPlate, openRank: 1 })];
        expectInPlaceAndClear(one, placePlates(one, SCREEN), { opened: 1 });
      }
      // Its token reaching under the top bar (56): the plate hangs from the bar's edge, over its thing.
      const top = [thing("top", 600, 100, 1, { token: DRAWN.armyToken, opened: DRAWN.armyPlate, openRank: 1 })];
      const placed = placePlates(top, SCREEN);
      expect(placed.spots.get("top")).toMatchObject({ shape: "plate", y: 56 });
      expectInPlaceAndClear(top, placed, { opened: 1 });
    });

    it("stands beside a HUD column, still over its token", () => {
      const screen = { ...SCREEN, columns: [{ x: 0, y: 0, width: 350, height: 1080 }] };
      const things = [thing("hovered", 390, 500, 1, { token: DRAWN.armyToken, opened: DRAWN.armyPlate, openRank: 1 })];
      const placed = placePlates(things, screen, { at: { x: 390, y: 530 }, size: DRAWN.line });
      // The plate slid off the column, the line beside the tile on the other side.
      expect(placed.spots.get("hovered")).toMatchObject({ shape: "plate" });
      expect((placed.spots.get("hovered") as { x: number }).x).toBeGreaterThanOrEqual(356);
      expectInPlaceAndClear(things, placed, { screen, opened: 1, line: DRAWN.line });
    });

    it("keeps the hovered thing its token where its plate has no place clear of a kept token", () => {
      // Kept tokens on either side of the hovered one: the wide plate cannot cover its token's middle without covering
      // one of them, which it never does.
      const wide = { width: 300, height: 80 };
      const things = [
        thing("selected", 40, 500, 1, { keep: true }),
        thing("own", 180, 500, 1, { keep: true }),
        thing("hovered", 110, 500, 1, { opened: wide, openRank: 1 }),
      ];
      const placed = placePlates(things, SCREEN);
      expect([...placed.closed]).toEqual(["hovered"]);
      expect(placed.spots.get("hovered")).toMatchObject({ shape: "token" });
      expect(placed.spots.get("selected")).toMatchObject({ shape: "token", yields: false });
      expectInPlaceAndClear(things, placed, { opened: 0 });
    });

    it("stays in place of its token on a crowded map, clear of every other label", () => {
      const things = Array.from({ length: 60 }, (_, index) =>
        thing(`t${index}`, 120 + (index % 10) * 90, 160 + Math.floor(index / 10) * 90, 1, {
          ...(index === 24 ? { opened: DRAWN.armyPlate, openRank: 1 } : {}),
        }),
      );
      const placed = placePlates(things, SCREEN);
      expectInPlaceAndClear(things, placed, { opened: 1 });
    });
  });

  describe("a label stands above its thing, never on it, at every zoom (the owner, 2026-10-20, playing dev Frontier)", () => {
    it("near: an army's and a camp's token stand on their label points, above them (owner-army-label-on.png)", () => {
      const things = [
        thing("army", 500, 400, 1, { token: DRAWN.armyToken }),
        thing("camp", 900, 400, 1, { token: DRAWN.campToken }),
      ];
      const { spots } = placePlates(things, SCREEN);
      for (const one of things) expect(onItsPoint(one, spots.get(one.id))).toBe(true);
      expect(spots.get("army")).toMatchObject({ x: 500 - 37, y: 400 - 50 });
    });

    it("near: an opened army plate stands above its army, never hung over it, though it hides a token above", () => {
      // The hovered army's plate standing on its foot covers the token of the thing above it; hung from the token's top
      // it would have spared that token and covered the army instead.
      const things = [
        thing("hovered", 400, 500, 1, { token: DRAWN.armyToken, opened: DRAWN.armyPlate, openRank: 1 }),
        thing("above", 400, 440, 2, { token: DRAWN.armyToken }),
      ];
      const placed = placePlates(things, SCREEN);
      const plate = placed.spots.get("hovered") as { shape: string; y: number };
      expect(plate.shape).toBe("plate");
      expect(plate.y + DRAWN.armyPlate.height).toBeLessThanOrEqual(500);
      expect(placed.spots.get("above")).toMatchObject({ shape: "token", yields: true });
    });

    it("max zoom out: a camp's token stays on its camp beside an army's, not a step away (owner-camp-label-zoomout.png)", () => {
      // Dev Frontier game 2 at max zoom out, read off the page: an army's token (64 × 50) on its point at 559,175, and a
      // site's (32 × 46) at 604,168, whose centred place meets the army's; the old layout drew it a step right, at 626.
      const things = [
        thing("army", 559, 175, 2, { token: { width: 64, height: 50 } }),
        thing("site", 604, 168, 1, { token: { width: 32, height: 46 } }),
      ];
      const { spots } = placePlates(things, SCREEN);
      for (const one of things) expect(onItsPoint(one, spots.get(one.id))).toBe(true);
      expect(narrowest(drawn(things, spots))).toBeGreaterThanOrEqual(6);
    });
  });

  describe("what must stay in view, however crowded (the owner, 2026-10-20: the selected thing, own armies, anything attacked)", () => {
    const army = (id: string, x: number, y: number, fields: Partial<PlateThing> = {}) =>
      thing(id, x, y, 68, { token: DRAWN.armyToken, keep: true, ...fields });
    /** A token stands over its own point: the point under its span, its foot at the point or higher, never lower. */
    const overItsPoint = (one: PlateThing, spot: PlateSpot | undefined) =>
      spot?.shape === "token" &&
      spot.y + one.token.height <= one.at.y &&
      one.at.x >= spot.x + 6 &&
      one.at.x <= spot.x + one.token.width - 6;

    /**
     * Every kept thing readable: its token drawn, not yielding, over its own point, and 6px clear of every other label
     * drawn (tokens, the hovered plate) and of the order line (at `line`'s size). A hovered one may be its plate instead.
     */
    const expectKeptReadable = (
      things: readonly PlateThing[],
      placed: ReturnType<typeof placePlates>,
      { line: lineSize = DRAWN.line, hovered }: { line?: { width: number; height: number }; hovered?: string } = {},
    ) => {
      const rects = drawn(things, placed.spots);
      const line = placed.orderLine ? [{ id: "line", ...placed.orderLine, ...lineSize }] : [];
      const opened = (one: PlateThing) => one.id === hovered && placed.spots.get(one.id)?.shape === "plate";
      for (const one of things.filter((candidate) => candidate.keep && !opened(candidate))) {
        const spot = placed.spots.get(one.id)!;
        expect({ id: one.id, shape: spot.shape, yields: spot.shape === "token" && spot.yields }).toEqual({
          id: one.id,
          shape: "token",
          yields: false,
        });
        expect(overItsPoint(one, spot), JSON.stringify({ one, spot })).toBe(true);
        const rect = rects.find((candidate) => candidate.id === one.id)!;
        for (const other of [...rects, ...line])
          if (other.id !== one.id) expect(gap(rect, other), JSON.stringify({ rect, other })).toBeGreaterThanOrEqual(6);
      }
    };

    it("rests a selected army as its token, beside another own army under the top bar (owner: no selected plate)", () => {
      // The reviewer's top-strip pair: two own armies 25px apart, the second selected. Selected, it opens no plate.
      const things = [army("first", 400, 120), army("selected", 425, 120)];
      const placed = placePlates(things, SCREEN);
      expect(placed.closed.size).toBe(0);
      expectKeptReadable(things, placed);
    });

    it("keeps both of two own armies 25px apart in view, side by side, each slid over its own point", () => {
      const things = [army("first", 400, 500), army("second", 425, 500)];
      const placed = placePlates(things, SCREEN);
      expectKeptReadable(things, placed);
      // Placed together, they need no rise: each slides within its own point, apart.
      expect(things.map((one) => (placed.spots.get(one.id) as { y: number }).y)).toEqual([450, 450]);
    });

    it("keeps a site in battle in view, and stands the tokens beside it over their points without lifting it", () => {
      const things = [
        thing("neutral camp", 400, 500, 15, { token: DRAWN.campToken }),
        thing("enemy army", 430, 500, 48, { token: DRAWN.armyToken }),
        thing("attacked camp", 470, 500, 15, { token: DRAWN.campToken, keep: true }),
        army("own", 520, 500),
      ];
      const placed = placePlates(things, SCREEN);
      expectKeptReadable(things, placed);
      // The neutral and enemy tokens are placed with the kept ones, each over its own point; the kept stand as alone.
      for (const one of things.filter((candidate) => !candidate.keep))
        expect(overItsPoint(one, placed.spots.get(one.id)), one.id).toBe(true);
      const alone = placePlates(
        things.filter((one) => one.keep),
        SCREEN,
      ).spots;
      for (const one of things.filter((candidate) => candidate.keep))
        expect((placed.spots.get(one.id) as { y: number }).y).toBe((alone.get(one.id) as { y: number }).y);
    });

    // Owner, 28 October 2026, on his phone: "Why dont I see the label ? I think we need to see the enemy label most of
    // the time". The lab's low-stamina game at his zoom (390 × 844): the army's token (78 × 50) and the beast's guarding
    // the ruin beside it (34 × 46), their label points 47px apart; the beast's token was not drawn.
    it("draws a beast's token beside the player's army, both on their own row and clear of each other", () => {
      const things = [
        army("own", 290, 349, { token: { width: 78, height: 50 } }),
        thing("beast", 337, 350, 15, { token: { width: 34, height: 46 } }),
      ];
      const placed = placePlates(things, { ...SCREEN, width: 390, height: 844 });
      expectKeptReadable(things, placed);
      expect(placed.spots.get("own")).toMatchObject({ shape: "token", y: 349 - 50 });
      expect(placed.spots.get("beast")).toMatchObject({ shape: "token", y: 350 - 46 });
      expect(overItsPoint(things[1], placed.spots.get("beast"))).toBe(true);
    });

    it("never lets the hovered plate or the order line cover a kept token: the plate stays closed without room", () => {
      // Own armies in a row 30px apart, the middle one's neighbour hovered, the line asked beside a kept tile.
      const things = [
        army("own a", 600, 500),
        army("own b", 630, 500),
        thing("hovered", 660, 500, 15, { token: DRAWN.campToken, opened: DRAWN.campPlate, openRank: 1 }),
        army("own c", 690, 500),
      ];
      const placed = placePlates(things, SCREEN, { at: { x: 630, y: 530 }, size: DRAWN.line });
      expectKeptReadable(things, placed);
    });

    it("stands a kept token on its own point when no arrangement of its cluster has room, never hiding it", () => {
      const things = [...[0, 1, 2].map((row) => army(`wall${row}`, 400, 500 - row * 56)), army("last", 400, 500)];
      const { spots } = placePlates(things, SCREEN);
      expect(overItsPoint(things[3], spots.get("last"))).toBe(true);
    });

    it.each([120, 330])(
      "keeps three kept armies in a 30px triangle apart and on their points at y %s (review-token-anchor-4)",
      (y) => {
        const things = [army("a", 400, y), army("b", 430, y), army("c", 415, y + 26)];
        expectKeptReadable(things, placePlates(things, SCREEN));
      },
    );

    /**
     * The world map's camera at its farthest distance, at a viewport's size: where a hex's label point (an army's, over
     * its model) and its ground point stand on screen, and a centre hex with its ring of six, nearest first.
     */
    const farthestView = (width: number, height: number) => {
      const distance = WORLDMAP_CAMERA_ZOOM.maxDistance;
      const pitch = resolveWorldmapCameraPitchRadians(distance);
      const camera = new PerspectiveCamera(
        resolveWorldmapCameraFieldOfViewDegrees(),
        width / height,
        0.1,
        distance * 3.5,
      );
      camera.position.set(0, Math.sin(pitch) * distance, Math.cos(pitch) * distance);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      const at = (col: number, row: number, y = ARMY_PLATE_HEIGHT) => {
        const p = latticeToWorld(col, row);
        const ndc = new Vector3(p.x, y, p.z).project(camera);
        return { x: ((ndc.x + 1) * width) / 2, y: ((1 - ndc.y) * height) / 2 };
      };
      const centre = latticeToWorld(0, 0);
      const flower = Array.from({ length: 25 }, (_, index) => ({
        col: (index % 5) - 2,
        row: Math.floor(index / 5) - 2,
      }))
        .map((hex) => ({
          ...hex,
          d: Math.hypot(latticeToWorld(hex.col, hex.row).x - centre.x, latticeToWorld(hex.col, hex.row).z - centre.z),
        }))
        .toSorted((a, b) => a.d - b.d)
        .slice(0, 7);
      const armyAt = (col: number, row: number, fields: Partial<PlateThing> = {}) =>
        army(`${col},${row}`, at(col, row).x, at(col, row).y, fields);
      return { at, flower, armyAt, screen: { ...SCREEN, width, height } };
    };

    it.each([
      [1280, 720, 6],
      [1440, 900, 7],
      [1920, 1080, 7],
    ])(
      "keeps every set of kept armies on a hex and its ring apart and on their points, in any order, at %sx%s, up to %s (review-token-anchor-5)",
      (width, height, most) => {
        const { flower, armyAt, screen } = farthestView(width, height);
        // The reviewer's three of review-token-anchor-4, and their six of review-token-anchor-5 in the order they came.
        const reviewed = [armyAt(0, 0), armyAt(1, 0), armyAt(1, 1)];
        expectKeptReadable(reviewed, placePlates(reviewed, screen));
        const six = [armyAt(0, 0), armyAt(1, -1), armyAt(-1, 0), armyAt(1, 0), armyAt(0, 1), armyAt(1, 1)];
        expectKeptReadable(six, placePlates(six, screen));
        // Every set of two or more of the seven, up to the most this viewport packs, in every rotation of its order and
        // each reversed: each kept token readable, and every order standing the same.
        for (let mask = 1; mask < 1 << flower.length; mask += 1) {
          const chosen = flower.filter((_, index) => mask & (1 << index));
          if (chosen.length < 2 || chosen.length > most) continue;
          const things = chosen.map(({ col, row }) => armyAt(col, row));
          const first = placePlates(things, screen);
          expectKeptReadable(things, first);
          for (let shift = 0; shift < things.length; shift += 1)
            for (const reversed of [false, true]) {
              const order = [...things.slice(shift), ...things.slice(0, shift)];
              const { spots } = placePlates(reversed ? order.toReversed() : order, screen);
              for (const one of things) expect(spots.get(one.id)).toEqual(first.spots.get(one.id));
            }
        }
      },
    );

    it("has no arrangement for a whole ring of seven kept armies at 1280x720 within two rows: each stands on its point", () => {
      // The stated limit: the owner accepted that these may overlap. Every token still stands over its own point.
      const { flower, armyAt, screen } = farthestView(1280, 720);
      const things = flower.map(({ col, row }) => armyAt(col, row));
      const { spots } = placePlates(things, screen);
      for (const one of things) expect(overItsPoint(one, spots.get(one.id)), one.id).toBe(true);
      expect(narrowest(drawn(things, spots))).toBeLessThan(6);
    });

    /** The reviewer's longer order line (review-token-anchor-5). */
    const REVIEWED_LINE = { width: 190, height: 46 };

    it.each([
      [1280, 720],
      [1440, 900],
      [1920, 1080],
    ])(
      "keeps the order line off a hovered kept army whose plate has no room, on real hexes at the bottom edge, %sx%s (review-token-anchor-5)",
      (width, height) => {
        const { at, armyAt, screen } = farthestView(width, height);
        let closedNearTheLine = 0;
        for (let row = 1; row <= 12; row += 1)
          for (const hover of [0, 1, 2]) {
            const hexes = [
              [0, row],
              [1, row],
              [1, row + 1],
            ];
            const things = hexes.map(([col, r], index) =>
              armyAt(col, r, index === hover ? { opened: DRAWN.armyPlate, openRank: 1 } : {}),
            );
            if (things.some((one) => one.at.y > height || one.at.y < 100)) continue;
            const [col, r] = hexes[hover];
            const placed = placePlates(things, screen, { at: at(col, r, 0), size: REVIEWED_LINE });
            if (placed.closed.has(things[hover].id) && placed.orderLine) closedNearTheLine += 1;
            // The hovered one resting as its token is kept like the others: the line stands clear of it, or is not drawn.
            expectKeptReadable(things, placed, { line: REVIEWED_LINE, hovered: things[hover].id });
          }
        // The case the reviewer found: (0,9), (1,9), (1,10) at 1920x1080, the last hovered, its plate with no room.
        if (width === 1920) expect(closedNearTheLine).toBeGreaterThan(0);
      },
    );

    it("keeps the order line off a hovered kept token whose plate closes, beside two kept neighbours at the bottom edge", () => {
      for (const y of [650, 680, 700, 710])
        for (const dx of [30, 40, 50]) {
          const things = [
            army("hovered", 640, y, { opened: DRAWN.armyPlate, openRank: 1 }),
            army("b", 640 + dx, y),
            army("c", 640 + dx / 2, y - 30),
          ];
          const screen = { ...SCREEN, width: 1280, height: 720 };
          const placed = placePlates(things, screen, { at: { x: 640, y: y + 20 }, size: REVIEWED_LINE });
          expectKeptReadable(things, placed, { line: REVIEWED_LINE, hovered: "hovered" });
        }
    });
  });

  it("puts the order line beside its tile clear of the opened plates and the HUD, and what it covers steps aside", () => {
    const line = { at: { x: 200, y: 310 }, size: { width: 80, height: 40 } };
    // Under its tile to the right when nothing opened is there.
    expect(placePlates([thing("s", 200, 300, 1)], SCREEN, line).orderLine).toEqual({ x: 212, y: 336 });
    // A hovered army's plate opened there: the line takes the tile's other side.
    const selected = thing("army", 260, 400, 1, { opened: { width: 100, height: 60 }, openRank: 1 });
    expect(placePlates([selected], SCREEN, line).orderLine).toEqual({ x: 108, y: 336 });
    // A plate opened on one neighbouring tile and a kept token on the other (their feet at y 364): every place beside
    // the tile meets one, so the line takes the first a row further down.
    const below = placePlates(
      [
        thing("kept", 150, 364, 1, { keep: true }),
        thing("right", 290, 364, 1, { opened: { width: 120, height: 40 }, openRank: 1 }),
      ],
      SCREEN,
      line,
    );
    expect(below.orderLine).toEqual({ x: 212, y: 336 + 40 + 6 });
    // A HUD column right of the tile: the line takes the tile's other side.
    const columns = [{ x: 230, y: 0, width: 400, height: 1080 }];
    expect(placePlates([], { ...SCREEN, columns }, line).orderLine).toEqual({ x: 108, y: 336 });
    // A resting token under the line steps aside while it shows.
    const under = placePlates([thing("below", 250, 360, 1)], SCREEN, line);
    expect(under.spots.get("below")).toMatchObject({ shape: "token", yields: true });
  });

  it("stands a token beside a HUD column it would reach under, and leaves one under a column where it is", () => {
    const columns = [{ x: 0, y: 0, width: 350, height: 1080 }];
    const { spots } = placePlates([thing("near", 380, 300, 1), thing("under", 100, 600, 0)], { ...SCREEN, columns });
    expect(spots.get("near")).toMatchObject({ shape: "token", x: 350 });
    expect(spots.get("under")).toMatchObject({ shape: "token", x: 68 });
  });
});
