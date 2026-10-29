import { formatExact } from "@bibliothecadao/types";
import { FONTS as FACES, HUD_TYPE } from "@/tokens";

import { type MapPlate } from "./map-plate-model";
import { plateRows, type PlateSegment } from "./map-plate-rows";

/** A rectangle on screen, in CSS pixels from the map's top left. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Size = { width: number; height: number };

/**
 * One thing on the map: its label point (`at`: right above the thing's model, where its token's foot stands), its
 * token's size, its plate's size when opened (its tile hovered), and what its place is worth.
 */
export interface PlateThing {
  id: string;
  at: { x: number; y: number };
  token: Size;
  /** Its plate's size opened: its tile is hovered. Absent while it rests as its token (selected included). */
  opened?: Size;
  /** Higher is placed first: the player's own, then what threatens them. Hover and selection never change it. */
  priority: number;
  /**
   * It must stay in view however crowded (the owner, 2026-10-20: the selected thing, the player's own armies, anything
   * under attack): the kept tokens are placed before every other, together (`placeKept`), each on its own point, slid
   * while attached, or a row or two straight up; no order line covers one, nor a hovered plate that has any other place.
   * The others yield to them, but for those standing near a kept one, which are placed with it, so a beast beside the
   * player's army keeps its label.
   */
  keep?: boolean;
  /** Among opened plates, higher is placed first (the hovered one is the only plate a thing opens). */
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
/** What a plate hung from the top bar's edge costs, in pixels slid: only a plate that cannot stand under the bar needs it. */
const HANG_COST = 40;
/**
 * A token slid aside keeps at least this much of itself past its label point on either side: it stays over its thing.
 */
const ATTACH_MARGIN = 6;
/**
 * What hiding another thing's resting token costs an opened plate's place, in pixels slid: a plate slides before it
 * hides a neighbour's label (qa-blitz-4 #4: a selected army's plate hid the army beside it, which a slide of
 * 18 px would have kept in view). Where every place hides one, the cheapest still stands, and the token steps aside.
 */
const HIDE_COST = 60;
/**
 * What covering a token kept in view costs an opened plate's place: more than any slide, hang or hidden neighbour, so a
 * plate covers one only where it has no other place, rather than stay closed (owner, 28 October 2026: "again on desktop
 * the hover label disappears at a certain zoom level"). The kept token steps aside while the plate is open.
 */
const COVER_KEPT_COST = 10_000;

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
 * A token's places (the owner, 2026-10-20: "label should be above not on the army"; "the camp label is gone way too far
 * at max zoom out"): standing on its thing's label point, centred over it, else slid aside, nearest first, never so far
 * that the point leaves the token (`ATTACH_MARGIN`). A thing kept in view (`keep`) may also stand a row or two higher,
 * straight over the same point, on screen. It is never lower than its thing's top nor away from it, at
 * any zoom.
 */
const tokenPlaces = (thing: PlateThing, screen: PlateScreen): Rect[] => {
  const { at, token } = thing;
  const reach = token.width / 2 - ATTACH_MARGIN;
  const shifts = [0];
  for (let dx = GAP; dx < reach; dx += GAP) shifts.push(-dx, dx);
  if (reach > 0) shifts.push(-reach, reach);
  const rows = thing.keep ? KEPT_ROWS : 0;
  return Array.from({ length: rows + 1 }, (_, row) => at.y - token.height - row * (token.height + GAP))
    .filter((y, row) => row === 0 || y >= 0)
    .flatMap((y) =>
      shifts.map((dx) => besideColumns({ x: at.x - token.width / 2 + dx, y, ...token }, at.x, screen.columns)),
    );
};
/** How many rows a kept thing's token may rise over its own point before it stands there regardless. */
const KEPT_ROWS = 2;

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
 * over the token's, so above its thing as the token is; else slid aside, never so far that it stops covering where its
 * token was drawn (`inPlaceOf`). On screen and clear of the HUD, except as far as covering its token needs: a plate that
 * would reach under the top bar standing is hung from the bar's edge instead. A hover never moves a token. Cheapest
 * first: pixels slid, a hung plate `HANG_COST` more, `HIDE_COST` for each resting token it would hide, and
 * `COVER_KEPT_COST` for each token kept in view (`kept`) it would cover.
 */
const placesInPlaceOf = (
  token: Rect,
  size: Size,
  screen: PlateScreen,
  others: readonly Rect[],
  kept: readonly Rect[],
): { rect: Rect; cost: number }[] => {
  const middle = token.x + token.width / 2;
  const reach = size.width / 2 - IN_PLACE_MARGIN;
  const shifts = [0];
  for (let dx = GAP; dx < reach; dx += GAP) shifts.push(dx, -dx);
  if (reach > 0) shifts.push(reach, -reach);
  const left = Math.min(SCREEN_EDGE, middle - IN_PLACE_MARGIN);
  const right = Math.max(screen.width - SCREEN_EDGE, middle + IN_PLACE_MARGIN);
  const bottom = Math.max(screen.height - SCREEN_EDGE, token.y + token.height);
  const obstacles = obstaclesFor(token, screen);
  const standing = token.y + token.height - size.height;
  // Standing, it would reach under the top bar: it hangs from the bar's edge instead, still over the token's middle.
  const hangs = standing < screen.top ? [{ y: screen.top, cost: HANG_COST }] : [];
  return [{ y: standing, cost: 0 }, ...hangs]
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
    .map(({ rect, cost }) => ({
      rect,
      cost:
        cost +
        HIDE_COST * others.filter((other) => !clear(rect, other)).length +
        COVER_KEPT_COST * kept.filter((box) => !clear(rect, box)).length,
    }))
    .toSorted((a, b) => a.cost - b.cost);
};

/**
 * Where every thing is drawn this frame, and the order line (map labels, the owner's plan D of 2026-10-19: "icons
 * everywhere, full plate on hover"): nothing drawn crowds or covers anything else, and every opened plate stands in its
 * token's place.
 *
 * 1. At rest every thing is its token; a selected one too, ringed (owner, 2026-10-20: "on army select i want to remove
 *    this panel"). The things kept in view (`keep`: the selected one, the player's own armies, anything in battle) are
 *    placed first, together with the things whose tokens could meet theirs (`placeKept`): beside the player's army, the
 *    beast it is about to fight keeps its label too (owner, 28 October 2026: "I think we need to see the enemy label
 *    most of the time"). Then the rest in priority order, each on the nearest of its places clear of every token placed
 *    before it, else not drawn. A hover or a selection never moves a resting token.
 * 2. The hovered plate and the order line are placed together: the plate in its drawn token's place
 *    (`placesInPlaceOf`), the line beside its tile, clear of each other and of the HUD, the line clear of every kept
 *    token, the plate too wherever it has such a place, at the least sliding. Where no such arrangement exists, the
 *    plate stays its token (`closed`): the layout never returns a plate away from its token or under the HUD.
 * 3. A resting token under the opened plate or the order line steps aside (`yields`) until they close: a kept one only
 *    under a plate that had no other place.
 */
export const placePlates = (
  things: readonly PlateThing[],
  screen: PlateScreen,
  orderLine: OrderLineAsk | null = null,
): { spots: Map<string, PlateSpot>; orderLine: { x: number; y: number } | null; closed: Set<string> } => {
  // The tokens kept in view stand first, placed together with those near them; then the others, by worth, around them.
  const kept = things.filter((thing) => thing.keep);
  const resting = placeKept(
    kept,
    things.filter((thing) => !thing.keep && kept.some((one) => mayMeet(thing, one))),
    screen,
  );
  const drawn: Rect[] = [...resting.values()];
  for (const thing of things.filter((one) => !resting.has(one.id)).toSorted((a, b) => b.priority - a.priority)) {
    const places = tokenPlaces(thing, screen);
    const box = places.find((place) => drawn.every((other) => clear(place, other)));
    if (box) drawn.push(box);
    resting.set(thing.id, box ?? places[0]);
  }
  const shown = new Set(drawn);
  // The kept tokens no plate or order line may cover.
  const keptRects = things.filter((thing) => thing.keep).map((thing) => resting.get(thing.id)!);

  // The hovered thing (the one plate a thing opens; a selected one rests as its token).
  const hovered = things.filter((thing) => thing.opened).toSorted((a, b) => (b.openRank ?? 0) - (a.openRank ?? 0))[0];
  const hoveredToken = hovered && resting.get(hovered.id)!;
  // Opened, its plate stands in its token's place; the other kept tokens stay in view around both.
  const keptBesideHovered = keptRects.filter((box) => box !== hoveredToken);
  const places =
    hovered &&
    placesInPlaceOf(
      hoveredToken!,
      hovered.opened!,
      screen,
      drawn.filter((box) => box !== hoveredToken),
      keptBesideHovered,
    );
  // Where the plate has no place clear of the line, it stays its token, and the line stands clear of every kept token
  // left on screen, that one included; where it has none, no line is drawn.
  const arranged =
    arrange(places ?? null, orderLine, screen, keptBesideHovered) ?? arrange(null, orderLine, screen, keptRects);
  const plates = new Map(hovered && arranged?.plate ? [[hovered.id, arranged.plate]] : []);
  const line = arranged?.line ?? null;

  const covers = [...plates.values(), ...(line && orderLine ? [{ ...line, ...orderLine.size }] : [])];
  const spots = new Map<string, PlateSpot>();
  for (const thing of things) {
    const plate = plates.get(thing.id);
    const rest = resting.get(thing.id)!;
    spots.set(
      thing.id,
      plate
        ? { shape: "plate", x: plate.x, y: plate.y }
        : shown.has(rest)
          ? {
              shape: "token",
              x: rest.x,
              y: rest.y,
              yields: !covers.every((cover) => clear(rest, cover)),
            }
          : { shape: "none" },
    );
  }
  const closed = new Set(hovered && !plates.has(hovered.id) ? [hovered.id] : []);
  return { spots, orderLine: line, closed };
};

/**
 * The tokens kept in view, placed together (review-token-anchor-4: one at a time, the first could take the only place
 * that let a third stand clear; review-token-anchor-5: a search over slides depended on the order things came in), with
 * the tokens near them where they fit. Things whose places could meet form a cluster. Its kept tokens take the
 * arrangement that rises least (none risen, else one row at most, else two), every token in one of its rows and slid
 * within its reach (`roomsOf`), all clear of each other (`packCluster`); then, where one exists, the arrangement that
 * also stands the tokens near them, rising least, with no kept token higher than alone: a neighbour never lifts the
 * player's army. Where none does, the near tokens are placed with the others. Where the search proves the kept tokens
 * have none, or stops at `KEPT_SEARCH` steps without an answer, each takes its nearest place still clear, else its own
 * point.
 */
const placeKept = (
  kept: readonly PlateThing[],
  near: readonly PlateThing[],
  screen: PlateScreen,
): Map<string, Rect> => {
  const placed = new Map<string, Rect>();
  const place = (things: readonly PlateThing[], rects: readonly Rect[]) =>
    things.forEach((thing, index) => placed.set(thing.id, rects[index]));
  for (const cluster of clustersOf([...kept, ...near])) {
    // Taken in one order whatever order they came in, so the same things on the same points always stand the same.
    const ordered = cluster.toSorted((a, b) => a.at.x - b.at.x || a.at.y - b.at.y || (a.id < b.id ? -1 : 1));
    const keptOnes = ordered.filter((thing) => thing.keep);
    const alone = packCluster(keptOnes, screen);
    const together = alone && keptOnes.length < ordered.length ? packCluster(ordered, screen, alone.risen) : null;
    if (together) place(ordered, together.rects);
    else if (alone) place(keptOnes, alone.rects);
    else
      for (const thing of keptOnes) {
        const places = tokenPlaces(thing, screen);
        placed.set(
          thing.id,
          places.find((place) => [...placed.values()].every((other) => clear(place, other))) ?? places[0],
        );
      }
  }
  return placed;
};

/** A kept token's room in one of its rows: the row, its top, and how far its left edge may slide while attached. */
type Room = { row: number; y: number; left: number; right: number };

/**
 * A kept token's rooms: on its own point and up to `KEPT_ROWS` rows straight above it on screen, each slid aside no
 * further than its point stays under it (`ATTACH_MARGIN`), and beside a HUD column it would reach under, as
 * `besideColumns` stands one.
 */
const roomsOf = (thing: PlateThing, screen: PlateScreen): Room[] => {
  const { at, token } = thing;
  const centred = at.x - token.width / 2;
  const reach = Math.max(0, token.width / 2 - ATTACH_MARGIN);
  const rooms: Room[] = [];
  for (let row = 0; row <= KEPT_ROWS; row += 1) {
    const y = at.y - token.height - row * (token.height + GAP);
    if (row > 0 && y < 0) break;
    let left = centred - reach;
    let right = centred + reach;
    for (const column of screen.columns) {
      if (y >= column.y + column.height || y + token.height <= column.y) continue;
      if (at.x >= column.x && at.x <= column.x + column.width) break;
      const rightOfIt = at.x > column.x + column.width;
      const edge = rightOfIt ? column.x + column.width : column.x - token.width;
      if (rightOfIt) left = Math.max(left, edge);
      else right = Math.min(right, edge);
      if (left > right) left = right = edge;
    }
    rooms.push({ row, y, left, right });
  }
  return rooms;
};

/**
 * One arrangement of a cluster's tokens, all clear of each other, rising least, no kept token above `keptRise` rows,
 * with the rows its tokens rose; null where there is none, or where the search stops at `KEPT_SEARCH` steps without an
 * answer.
 *
 * Read left to right, an arrangement is an order and a room for each token. Given those, each token's leftmost place
 * is exact: its room's left edge, or just clear of the tokens before it whose rows meet its own. Any arrangement, its
 * tokens taken in that order, has every token at or right of it, so the leftmost places are clear wherever any
 * arrangement is: the search tries orders and rows, never slides. It drops a choice that leaves a later token no room,
 * and tries two neighbours whose rows do not meet in one order only (either stands the same). The arrangement found
 * then draws each token as near its own point as the tokens to its left and right allow.
 */
const packCluster = (
  cluster: readonly PlateThing[],
  screen: PlateScreen,
  keptRise = KEPT_ROWS,
): { rects: Rect[]; risen: number } | null => {
  const rooms = cluster.map((thing) => roomsOf(thing, screen).filter((room) => !thing.keep || room.row <= keptRise));
  const meet = (a: number, ay: number, b: number, by: number) =>
    !(ay >= by + cluster[b].token.height + GAP || by >= ay + cluster[a].token.height + GAP);
  type Step = { index: number; room: Room; leftmost: number };
  for (let top = 0; top <= KEPT_ROWS; top += 1) {
    const steps: Step[] = [];
    let tries = 0;
    const leftmostOf = (index: number, room: Room) =>
      steps.reduce(
        (x, step) =>
          meet(index, room.y, step.index, step.room.y)
            ? Math.max(x, step.leftmost + cluster[step.index].token.width + GAP)
            : x,
        room.left,
      );
    const fits = (index: number) =>
      rooms[index].some((room) => room.row <= top && leftmostOf(index, room) <= room.right);
    const visit = (remaining: readonly number[]): boolean | null => {
      if (remaining.length === 0) return true;
      const last = steps.at(-1);
      for (const index of remaining)
        for (const room of rooms[index]) {
          if (room.row > top) break;
          if (last && index < last.index && !meet(index, room.y, last.index, last.room.y)) continue;
          const leftmost = leftmostOf(index, room);
          if (leftmost > room.right) continue;
          if ((tries += 1) > KEPT_SEARCH) return null;
          steps.push({ index, room, leftmost });
          const rest = remaining.filter((other) => other !== index);
          const found = rest.every(fits) ? visit(rest) : false;
          if (found !== false) return found;
          steps.pop();
        }
      return false;
    };
    if (!visit(cluster.map((_, index) => index))) continue;
    // Right to left, each token's rightmost place given those after it; then left to right, each as near its own point
    // as its leftmost and rightmost allow.
    const rightmost = steps.map((step) => step.room.right);
    for (let i = steps.length - 1; i >= 0; i -= 1)
      for (let j = i + 1; j < steps.length; j += 1)
        if (meet(steps[i].index, steps[i].room.y, steps[j].index, steps[j].room.y))
          rightmost[i] = Math.min(rightmost[i], rightmost[j] - cluster[steps[i].index].token.width - GAP);
    const result: Rect[] = new Array(cluster.length);
    const xs: number[] = [];
    steps.forEach((step, i) => {
      const thing = cluster[step.index];
      const leftmost = steps
        .slice(0, i)
        .reduce(
          (x, before, j) =>
            meet(step.index, step.room.y, before.index, before.room.y)
              ? Math.max(x, xs[j] + cluster[before.index].token.width + GAP)
              : x,
          step.room.left,
        );
      xs.push(Math.min(Math.max(thing.at.x - thing.token.width / 2, leftmost), rightmost[i]));
      result[step.index] = { x: xs[i], y: step.room.y, ...thing.token };
    });
    return { rects: result, risen: top };
  }
  return null;
};

/** How many choices the search for a cluster's arrangement makes at each height before it stops without an answer. */
const KEPT_SEARCH = 5_000;

/** Whether two things' tokens could meet, risen or slid as far as a kept token goes. */
const mayMeet = (a: PlateThing, b: PlateThing) => {
  const reachOf = (thing: PlateThing) => ({
    across: thing.token.width + GAP,
    up: (KEPT_ROWS + 1) * (thing.token.height + GAP),
  });
  return (
    Math.abs(a.at.x - b.at.x) < reachOf(a).across + reachOf(b).across &&
    Math.abs(a.at.y - b.at.y) < Math.max(reachOf(a).up, reachOf(b).up)
  );
};

/** Things whose tokens' places could meet, risen or slid as far as they go: each group placed together. */
const clustersOf = (kept: readonly PlateThing[]): PlateThing[][] => {
  const group = kept.map((_, index) => index);
  const root = (index: number): number => (group[index] === index ? index : (group[index] = root(group[index])));
  kept.forEach((a, i) => kept.forEach((b, j) => j > i && mayMeet(a, b) && (group[root(j)] = root(i))));
  const clusters = new Map<number, PlateThing[]>();
  kept.forEach((thing, index) => clusters.set(root(index), [...(clusters.get(root(index)) ?? []), thing]));
  return [...clusters.values()];
};

/**
 * The hovered plate's cheapest place with the order line clear of it, or the line alone with nothing hovered; null where
 * none holds both.
 */
const arrange = (
  places: readonly { rect: Rect; cost: number }[] | null,
  orderLine: OrderLineAsk | null,
  screen: PlateScreen,
  kept: readonly Rect[],
): { plate: Rect | null; line: { x: number; y: number } | null } | null => {
  for (const place of places ?? [null]) {
    const plate = place?.rect ?? null;
    const line = orderLine && placeOrderLine(orderLine, [...(plate ? [plate] : []), ...kept], screen);
    if (!orderLine || line) return { plate, line };
  }
  return null;
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
  // With a plate opened on a neighbouring tile (the hovered thing's, in place of its token), the same places one and
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
  `${HUD_TYPE[weight].weight} ${HUD_TYPE[role].size} ${FACES.body}`;
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

/** A plate's size opened (its thing hovered), from the rows it draws. */
export const plateSize = (plate: MapPlate): Size => {
  const rows = plateRows(plate);
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
