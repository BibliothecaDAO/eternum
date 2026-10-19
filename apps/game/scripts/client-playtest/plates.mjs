import { blocked, completed, failed } from "./evidence.mjs";

/**
 * The map's labels as a player sees them, measured on the page (map labels, owner 2026-10-19: "the label placement on
 * the map need work"): every drawn token and opened plate (shown, not stepped aside) with its layer key, its rectangle as
 * drawn, the order line's when it is up, and every pair that overlaps or stands closer than `CROWDED_PX`. A page script
 * for `browser.read`. `judgePlates` then measures each opened plate against the token drawn for the same thing in an
 * earlier reading, before it opened: the page's own record, not a number the layer writes.
 */
const CROWDED_PX = 4;
/** Rounding between two readings of the page: never a drift. */
const IN_PLACE_PX = 4;

export const PLATES_EXPRESSION = `JSON.stringify((() => {
  const shown = (element) => {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.05) return false;
    }
    return true;
  };
  const box = (rect) => ({ x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) });
  const words = (element) => element.innerText.replace(/\\s+/g, " ").trim().slice(0, 48);
  const things = [...document.querySelectorAll(".mp-at")]
    .filter((at) => at.firstElementChild && shown(at))
    .map((at) => {
      const plate = at.querySelector(".mp-plate");
      return {
        kind: plate ? "plate" : "token",
        key: at.dataset.key,
        open: plate?.dataset.open === "true",
        selected: at.dataset.selected === "true",
        text: words(at),
        ...box(at.firstElementChild.getBoundingClientRect()),
      };
    })
    .filter((thing) => thing.x + thing.w > 0 && thing.y + thing.h > 0 && thing.x < innerWidth && thing.y < innerHeight);
  const line = [...document.querySelectorAll('[role="tooltip"]')].find((tip) => shown(tip) && tip.getBoundingClientRect().width > 0);
  if (line) things.push({ kind: "order line", text: words(line), ...box(line.getBoundingClientRect()) });
  const gap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
  const overlaps = [];
  const crowded = [];
  for (let i = 0; i < things.length; i += 1)
    for (let j = i + 1; j < things.length; j += 1) {
      const pair = { a: things[i].text || things[i].kind, b: things[j].text || things[j].kind, gap: gap(things[i], things[j]) };
      if (pair.gap < 0) overlaps.push(pair);
      else if (pair.gap < ${CROWDED_PX}) crowded.push(pair);
    }
  return {
    labels: things.filter((thing) => thing.kind !== "order line").length,
    opened: things.filter((thing) => thing.open).length,
    tokens: things.filter((thing) => thing.kind === "token").length,
    orderLine: things.find((thing) => thing.kind === "order line") ?? null,
    overlaps,
    crowded,
    things,
  };
})())`;

/**
 * Each opened plate in `seen` against the token drawn for the same thing in `before` (a reading taken before it opened):
 * `measured` where both were read, with how far the token's middle stands from the plate's middle across and how far
 * the plate's foot stands from the token's (up positive); `far` those that do not cover where their token was (a few
 * pixels for rounding). A plate whose thing had no token drawn before is not measured.
 */
const awayFromTokens = (seen, before) => {
  const tokens = new Map(before.things.filter((thing) => thing.kind === "token").map((thing) => [thing.key, thing]));
  const measured = seen.things.flatMap((plate) => {
    const token = plate.open ? tokens.get(plate.key) : undefined;
    if (!token) return [];
    const middle = { x: token.x + token.w / 2, y: token.y + token.h / 2 };
    const covers =
      middle.x >= plate.x - IN_PLACE_PX &&
      middle.x <= plate.x + plate.w + IN_PLACE_PX &&
      middle.y >= plate.y - IN_PLACE_PX &&
      middle.y <= plate.y + plate.h + IN_PLACE_PX;
    return [
      {
        plate: plate.text,
        across: Math.round(Math.abs(plate.x + plate.w / 2 - middle.x)),
        up: Math.round(token.y + token.h - (plate.y + plate.h)),
        covers,
      },
    ];
  });
  return { measured, far: measured.filter((one) => !one.covers) };
};

/**
 * A reading's verdict: no token, plate or order line overlaps or crowds another, and, given the reading before anything
 * opened, every opened plate covers where its token was. A view with no label drawn (zoomed out, or off the world) has
 * nothing to judge: blocked, not passed.
 */
export const judgePlates = (seen, before = null) => {
  if (!seen || seen.labels === 0) return blocked("no map label is drawn in view", { seen });
  const { measured, far } = before ? awayFromTokens(seen, before) : { measured: [], far: [] };
  if (far.length > 0) return failed(`${far.length} opened plates stand away from their thing's token`, { seen, far });
  if (seen.overlaps.length > 0) return failed(`${seen.overlaps.length} pairs overlap`, { seen });
  if (seen.crowded.length > 0)
    return failed(`${seen.crowded.length} pairs stand closer than ${CROWDED_PX}px`, { seen });
  return completed({
    labels: seen.labels,
    opened: seen.opened,
    tokens: seen.tokens,
    orderLine: seen.orderLine,
    measured,
  });
};
