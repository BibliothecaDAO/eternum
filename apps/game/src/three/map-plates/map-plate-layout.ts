import { formatExact } from "@bibliothecadao/types";
import { CLASSIC_HUD_FONTS, HUD_TYPE } from "@/tokens";

import { type MapPlate } from "./map-plate-model";
import { plateRows, type PlateSegment, type PlateView } from "./map-plate-rows";

/** A rectangle on screen, in CSS pixels from the map's top left. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Size = { width: number; height: number };

/**
 * One thing on the map: where its token stands (its middle: the thing's label point, right above it), its token's size,
 * its plate's size when opened (its tile hovered, or it selected), and what its place is worth.
 */
export interface PlateThing {
  id: string;
  at: { x: number; y: number };
  token: Size;
  /** Its plate's size opened: its tile is hovered, or it is selected. Absent while it rests as its token. */
  opened?: Size;
  /** Higher is placed first: the player's own, then what threatens them. Hover and selection never change it. */
  priority: number;
  /** Among opened plates, higher is placed first: the selected one, then the hovered one. */
  openRank?: number;
}

/** Where a thing is drawn (top left): its token at rest, its plate opened in the token's place, or nothing. */
export type PlateSpot =
  | { shape: "plate"; x: number; y: number }
  | { shape: "token"; x: number; y: number; yields: boolean }
  | { shape: "none" };

/** The map's order line for the tile under the pointer: the tile's place on screen and the line's size. */
export interface OrderLineAsk {
  at: { x: number; y: number };
  size: Size;
}

/** What the screen leaves the plates: its size, the HUD's side columns, and the bar across its top. */
interface PlateScreen {
  width: number;
  height: number;
  columns: readonly Rect[];
  top: number;
}

/** The space every token, plate and the order line keep between them, so none crowds another. */
const GAP = 6;
/** The order line's places beside its tile, the first that is clear: under it to the right, then around. */
const LINE_OFFSET = { x: 12, y: 26 };
const SCREEN_EDGE = 8;
/**
 * An opened plate covers the middle of the token it replaces with at least this much of itself on either side: it
 * stands where its token stood, slid aside at most this short of its own half (`inPlaceOf`).
 */
const IN_PLACE_MARGIN = 12;
/** What a plate hung from its token's top (over its thing, not standing on the token's foot) costs, in pixels slid. */
const HANG_COST = 40;
/** The selected plate is moved this much less willingly than the hovered one: it is the one the player is reading. */
const RANK_WEIGHT = 2;

const clear = (a: Rect, b: Rect) =>
  a.x >= b.x + b.width + GAP ||
  b.x >= a.x + a.width + GAP ||
  a.y >= b.y + b.height + GAP ||
  b.y >= a.y + a.height + GAP;

/**
 * An opened plate stands in place of its token when it covers the token's middle, with `IN_PLACE_MARGIN` of itself on
 * either side across: where the token was drawn is under the plate, never beside it. The layout keeps it, and the plate
 * probe measures it against the token as drawn before the plate opened.
 */
export const inPlaceOf = (plate: Rect, token: Rect): boolean => {
  const middle = { x: token.x + token.width / 2, y: token.y + token.height / 2 };
  return (
    middle.x >= plate.x + IN_PLACE_MARGIN &&
    middle.x <= plate.x + plate.width - IN_PLACE_MARGIN &&
    middle.y >= plate.y &&
    middle.y <= plate.y + plate.height
  );
};

/**
 * A token or plate that would reach under one of the HUD's side columns stands beside it instead; a thing under a column
 * keeps its place there (the column hides it too).
 */
const besideColumns = (box: Rect, anchorX: number, columns: readonly Rect[]): Rect => {
  for (const column of columns) {
    if (box.y >= column.y + column.height || box.y + box.height <= column.y) continue;
    if (anchorX >= column.x && anchorX <= column.x + column.width) return box;
    if (box.x < column.x + column.width && box.x + box.width > column.x)
      return { ...box, x: anchorX > column.x + column.width ? column.x + column.width : column.x - box.width };
  }
  return box;
};

/**
 * A token's places, nearest its thing first: centred over it; a step to either side; half a step to either side, one
 * row up or down. A token never strays further than one token from its thing; with none of them clear it is not drawn.
 */
const tokenPlaces = (thing: PlateThing, columns: readonly Rect[]): Rect[] => {
  const { at, token } = thing;
  const across = token.width + GAP;
  const down = token.height + GAP;
  return [
    [0, 0],
    [-across, 0],
    [across, 0],
    [-across / 2, -down],
    [across / 2, -down],
    [-across / 2, down],
    [across / 2, down],
  ].map(([dx, dy]) =>
    besideColumns({ x: at.x - token.width / 2 + dx, y: at.y - token.height / 2 + dy, ...token }, at.x, columns),
  );
};

/** What an opened plate may not cover: the HUD's columns (but one over its token's middle) and the top bar. */
const obstaclesFor = (token: Rect, screen: PlateScreen): Rect[] => {
  const middle = token.x + token.width / 2;
  return [
    ...screen.columns.filter((column) => middle < column.x || middle > column.x + column.width),
    { x: -1e5, y: -1e5, width: 2e5, height: 1e5 + screen.top - GAP },
  ];
};

/**
 * A thing's plate, opened, replaces its token in place (the owner, 2026-10-19 13:00Z: "always keep the ring above the
 * structure/army and replace it by the hover/selected modal when i'm on it"): standing on the token's foot, its middle
 * over the token's; else slid aside, or hung from the token's top over its thing, never so far that it stops covering
 * where its token was drawn (`inPlaceOf`). On screen and clear of the HUD, except as far as covering its token needs.
 * Cheapest first: pixels slid, and a hung plate costs `HANG_COST` more.
 */
const placesInPlaceOf = (token: Rect, size: Size, screen: PlateScreen): { rect: Rect; cost: number }[] => {
  const middle = token.x + token.width / 2;
  const reach = size.width / 2 - IN_PLACE_MARGIN;
  const shifts = [0];
  for (let dx = GAP; dx < reach; dx += GAP) shifts.push(dx, -dx);
  if (reach > 0) shifts.push(reach, -reach);
  const left = Math.min(SCREEN_EDGE, middle - IN_PLACE_MARGIN);
  const right = Math.max(screen.width - SCREEN_EDGE, middle + IN_PLACE_MARGIN);
  const bottom = Math.max(screen.height - SCREEN_EDGE, token.y + token.height);
  const obstacles = obstaclesFor(token, screen);
  return [
    { y: token.y + token.height - size.height, cost: 0 },
    { y: token.y, cost: HANG_COST },
    // A token reaching under the top bar: its plate hangs from the bar's edge instead, still over the token's middle.
    ...(token.y < screen.top ? [{ y: screen.top, cost: HANG_COST }] : []),
  ]
    .flatMap(({ y, cost }) =>
      shifts.map((dx) => ({ rect: { x: middle - size.width / 2 + dx, y, ...size }, cost: cost + Math.abs(dx) })),
    )
    .filter(
      ({ rect }) =>
        rect.x >= left &&
        rect.x + rect.width <= right &&
        rect.y + rect.height <= bottom &&
        inPlaceOf(rect, token) &&
        obstacles.every((obstacle) => clear(rect, obstacle)),
    )
    .toSorted((a, b) => a.cost - b.cost);
};

/**
 * Where every thing is drawn this frame, and the order line (map labels, the owner's plan D of 2026-10-19: "icons
 * everywhere, full plate on hover"): nothing drawn crowds or covers anything else, and every opened plate stands in its
 * token's place.
 *
 * 1. At rest every thing is its token; in priority order each takes the nearest of its places clear of every token kept
 *    before it, else it is not drawn. Hover and selection never move a resting token.
 * 2. The opened plates (the selected, the hovered) and the order line are placed together: each plate in its drawn
 *    token's place (`placesInPlaceOf`), clear of the others, and the line beside its tile, clear of them all, at the
 *    least sliding (the selected plate's weighs double). Where no such arrangement exists, the plate opened last (the
 *    hovered one) stays its token (`closed`): the layout never returns a plate over another, or away from its token.
 * 3. A resting token under an opened plate or the order line steps aside (`yields`) until they close.
 */
export const placePlates = (
  things: readonly PlateThing[],
  screen: PlateScreen,
  orderLine: OrderLineAsk | null = null,
): { spots: Map<string, PlateSpot>; orderLine: { x: number; y: number } | null; closed: Set<string> } => {
  const kept: Rect[] = [];
  const resting = new Map<string, Rect>();
  for (const thing of things.toSorted((a, b) => b.priority - a.priority)) {
    const places = tokenPlaces(thing, screen.columns);
    const box = places.find((place) => kept.every((other) => clear(place, other)));
    if (box) kept.push(box);
    resting.set(thing.id, box ?? places[0]);
  }

  const asked = things
    .filter((thing) => thing.opened)
    .toSorted((a, b) => (b.openRank ?? 0) - (a.openRank ?? 0))
    .map((thing, index, all) => ({
      id: thing.id,
      weight: index < all.length - 1 ? RANK_WEIGHT : 1,
      places: placesInPlaceOf(resting.get(thing.id)!, thing.opened!, screen),
    }));
  let open = asked;
  let arranged = arrange(open, orderLine, screen);
  while (!arranged && open.length > 0) {
    open = open.slice(0, -1);
    arranged = arrange(open, orderLine, screen);
  }
  const plates = new Map(open.map((one, index) => [one.id, arranged!.rects[index]]));
  const line = arranged?.line ?? null;

  const covers = [...plates.values(), ...(line && orderLine ? [{ ...line, ...orderLine.size }] : [])];
  const drawn = new Set(kept);
  const spots = new Map<string, PlateSpot>();
  for (const thing of things) {
    const plate = plates.get(thing.id);
    const rest = resting.get(thing.id)!;
    spots.set(
      thing.id,
      plate
        ? { shape: "plate", x: plate.x, y: plate.y }
        : drawn.has(rest)
          ? { shape: "token", x: rest.x, y: rest.y, yields: !covers.every((cover) => clear(rest, cover)) }
          : { shape: "none" },
    );
  }
  const closed = new Set(asked.filter((one) => !plates.has(one.id)).map((one) => one.id));
  return { spots, orderLine: line, closed };
};

/**
 * The cheapest arrangement of the opened plates (each among its places, clear of the others) with the order line clear
 * of them all; null where none exists. A branch and bound over each plate's places, cheapest first.
 */
const arrange = (
  open: readonly { places: readonly { rect: Rect; cost: number }[]; weight: number }[],
  orderLine: OrderLineAsk | null,
  screen: PlateScreen,
): { rects: Rect[]; line: { x: number; y: number } | null } | null => {
  let best = null as { cost: number; rects: Rect[]; line: { x: number; y: number } | null } | null;
  const chosen: Rect[] = [];
  const visit = (index: number, cost: number) => {
    if (index === open.length) {
      const line = orderLine && placeOrderLine(orderLine, chosen, screen);
      if (orderLine && !line) return;
      best = { cost, rects: [...chosen], line };
      return;
    }
    const { places, weight } = open[index];
    for (const place of places) {
      const total = cost + place.cost * weight;
      if (best && total >= best.cost) return;
      if (!chosen.every((other) => clear(place.rect, other))) continue;
      chosen.push(place.rect);
      visit(index + 1, total);
      chosen.pop();
    }
  };
  visit(0, 0);
  return best;
};

/**
 * The order line's place: beside its tile, under it to the right first, on screen and clear of every opened plate and
 * the HUD's columns; one or two rows further down where every place beside it is taken. Null where none is clear.
 */
const placeOrderLine = (
  ask: OrderLineAsk,
  opened: readonly Rect[],
  screen: PlateScreen,
): { x: number; y: number } | null => {
  const { at, size } = ask;
  const beside = [
    { x: at.x + LINE_OFFSET.x, y: at.y + LINE_OFFSET.y },
    { x: at.x - LINE_OFFSET.x - size.width, y: at.y + LINE_OFFSET.y },
    { x: at.x - size.width / 2, y: at.y + LINE_OFFSET.y + size.height / 2 },
    { x: at.x + 2 * LINE_OFFSET.x, y: at.y - size.height / 2 },
    { x: at.x - 2 * LINE_OFFSET.x - size.width, y: at.y - size.height / 2 },
  ];
  // With a plate opened on a neighbouring tile (the selected army's, in place of its token), the same places one and
  // two rows further down, still beside the tile, before it would sit on a plate.
  const row = size.height + GAP;
  const blocked = [...opened, ...screen.columns.filter((column) => at.x < column.x || at.x > column.x + column.width)];
  return (
    [0, row, 2 * row]
      .flatMap((down) => beside.map(({ x, y }) => ({ x, y: y + down })))
      .map(({ x, y }) => ({
        x: Math.round(Math.max(SCREEN_EDGE, Math.min(x, screen.width - size.width - SCREEN_EDGE))),
        y: Math.round(Math.max(screen.top, Math.min(y, screen.height - size.height - SCREEN_EDGE))),
      }))
      .find((place) => blocked.every((box) => clear({ ...place, ...size }, box))) ?? null
  );
};

/** A row's height, the plate's padding and frame, the gap between readings: as map-plates.css draws them. */
const ROW_HEIGHT = 24;
const PLATE_PADDING_Y = 6;
const PLATE_PADDING_X = 6 + 8 + 3 + 1;
const READING_GAP = 6;

/** The plate's faces, as map-plates.css draws them from the HUD sheet: every reading at the body size, told by weight. */
const face = (role: keyof typeof HUD_TYPE, weight: keyof typeof HUD_TYPE = role) =>
  `${HUD_TYPE[weight].weight} ${HUD_TYPE[role].size} ${CLASSIC_HUD_FONTS.ui}`;
const FONTS = {
  body: face("body"),
  title: face("body", "title"),
  count: face("body", "strong"),
  chip: face("label"),
  label: face("label"),
  labelStrong: face("label", "strong"),
} as const;

/** A text's drawn width in one of the plate's faces. */
const measure = (() => {
  let context: CanvasRenderingContext2D | null | undefined;
  return (text: string, font: keyof typeof FONTS) => {
    if (context === undefined)
      context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    if (!context) return text.length * 8;
    context.font = FONTS[font];
    return context.measureText(text).width;
  };
})();

/** A troop stack's painting, and the sheet chip's padding and border around its letters (hud-sheet.css .ui-chip). */
const TROOP_PAINTING = 20;
/** An opened army's stamina bar at its shortest, before its "x/y" (it stretches to the plate's width). */
const STAMINA_BAR = 36;
const CHIP_PADDING = 2 * 6 + 2;

/** A tier chip's drawn width (hud-sheet.css .ui-chip): its letters, its padding and frame. */
export const chipWidth = (tier: 1 | 2 | 3): number => measure(`T${tier}`, "chip") + CHIP_PADDING;

/** A count's or an amount's drawn width at the label size, told by weight: a mark's words (map-plate-token.tsx). */
export const labelWidth = (text: string, strong = false): number => measure(text, strong ? "labelStrong" : "label");

const segmentWidth = (segment: PlateSegment): number => {
  switch (segment.kind) {
    case "label":
    case "cue":
      return measure(segment.text, "body");
    case "owner":
    case "word":
    case "title":
      return measure(segment.text, "title");
    case "troops":
      return (
        TROOP_PAINTING +
        measure(`T${segment.troops.tier}`, "chip") +
        CHIP_PADDING +
        measure(formatExact(segment.troops.count), "count") +
        2 * 4
      );
    case "stamina":
      return STAMINA_BAR + READING_GAP + measure(`${formatExact(segment.current)}/${formatExact(segment.max)}`, "body");
    case "next":
      return measure("›", "count") + 4;
    case "divider":
      return 1;
  }
};

/** A plate's size opened (hovered, or selected), from the rows it draws. */
export const plateSize = (plate: MapPlate, view: PlateView): Size => {
  const rows = plateRows(plate, view);
  const width = Math.max(
    ...rows.map((row) => row.reduce((sum, segment) => sum + segmentWidth(segment), 0) + READING_GAP * (row.length - 1)),
  );
  return { width: Math.ceil(width + PLATE_PADDING_X), height: rows.length * ROW_HEIGHT + PLATE_PADDING_Y };
};

/** The order line's padding and frame, and the gap between its line and its cost (hud-sheet.css .ui-tip). */
const LINE_PADDING = { x: 2 * 12 + 2, y: 2 * 6 + 2 };
const LINE_ROW_GAP = 2;

/** The order line's size, from its words: its order at the body size, and its cost under it at the label size. */
export const orderLineSize = (line: string, cost: string | null): Size => ({
  width: Math.ceil(Math.max(measure(line, "body"), cost ? measure(cost, "label") : 0) + LINE_PADDING.x),
  height: LINE_PADDING.y + parseInt(HUD_TYPE.body.line) + (cost ? LINE_ROW_GAP + parseInt(HUD_TYPE.label.line) : 0),
});
