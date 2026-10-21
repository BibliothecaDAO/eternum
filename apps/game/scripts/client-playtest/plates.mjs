import { blocked, completed, failed } from "./evidence.mjs";

/**
 * The map's labels as a player sees them, measured on the page (map labels, owner 2026-10-19: "the label placement on
 * the map need work"): every drawn token and opened plate (shown, not stepped aside) with its layer key, its rectangle as
 * drawn, the order line's when it is up, and every pair that overlaps or stands closer than `CROWDED_PX`. A page script
 * for `browser.read`. `judgePlates` then measures each opened plate against the token drawn for the same thing in an
 * earlier reading, before it opened: the page's own record, not a number the layer writes.
 *
 * Each label also carries its thing as the renderer places it (`over`, owner 2026-10-20: "label should be above not on
 * the army"; "the camp label is gone way too far at max zoom out"): the thing's tile and its model's top, projected
 * through the map's camera. A structure's top is its label point less the clearance the manager adds over its model; an
 * army's is its tile plus the tallest army as drawn (`ARMY_MODEL_TOP`), whatever the army's troops. Read from the world
 * managers, not from the label layer.
 */
const CROWDED_PX = 4;
/** Rounding between two readings of the page: never a drift. */
const IN_PLACE_PX = 4;
/** A label's edge and its thing's projected point, each rounded to the pixel. */
const ROUNDING_PX = 1;
/**
 * The tallest army's top over its tile as drawn (grounded; a T3 ship at its waterline): the asset check
 * `army-plate-height.test.ts` measures every army and holds this equal to the tallest.
 */
export const ARMY_MODEL_TOP = 1.28;
/** An army's label point over its tile: `ARMY_PLATE_HEIGHT` (army-constants.ts), held equal by a test. */
export const ARMY_LABEL_POINT = 1.45;
/** How far over its model's top a structure's label point stands (`PLATE_CLEARANCE`, structure-visible-presentation). */
const STRUCTURE_CLEARANCE = 0.45;

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
  // The thing a label names, as the world managers place it: its tile and its model's top on screen. Null off the map.
  const world = window.__gameRenderer?.worldmapScene;
  const canvas = document.getElementById("main-canvas")?.getBoundingClientRect();
  const onScreen = (point) => {
    const projected = point.clone().project(world.camera);
    return { x: Math.round(canvas.left + ((projected.x + 1) / 2) * canvas.width), y: Math.round(canvas.top + ((1 - projected.y) / 2) * canvas.height) };
  };
  // The map label lab reports its fixture world the same way: its camera, canvas and each thing's tile and model top.
  const lab = world ? null : window.__mapLabelLab;
  const thingOf = (key) => {
    if (lab && key) {
      const thing = lab.things.find((one) => one.key === key);
      if (!thing) return null;
      const box = lab.canvas.getBoundingClientRect();
      const toScreen = (point) => {
        const projected = point.clone().project(lab.camera);
        return { x: Math.round(box.left + ((projected.x + 1) / 2) * box.width), y: Math.round(box.top + ((1 - projected.y) / 2) * box.height) };
      };
      return { tile: toScreen(thing.tile), top: toScreen(thing.top), point: toScreen(thing.point) };
    }
    if (!world?.camera || !canvas || !key) return null;
    const [kind, id] = key.split(":");
    if (kind === "army") {
      const army = world.armyManager?.getArmy(Number(id));
      if (!army) return null;
      const tile = world.armyManager.getArmyWorldPositionInto(world.camera.position.clone(), army.hexCoords);
      return {
        tile: onScreen(tile),
        top: onScreen(tile.clone().setY(tile.y + ${ARMY_MODEL_TOP})),
        point: onScreen(tile.clone().setY(tile.y + ${ARMY_LABEL_POINT})),
      };
    }
    if (kind === "structure") {
      const structure = world.structureManager?.resolveStructureInfoByEntityId(Number(id));
      if (!structure) return null;
      const point = world.structureManager.resolveStructureCompactLabelPosition(structure).clone();
      const top = point.clone().setY(point.y - ${STRUCTURE_CLEARANCE});
      return {
        tile: onScreen(top.clone().setY(top.y - world.structureManager.resolveStructureModelHeight(structure))),
        top: onScreen(top),
        point: onScreen(point),
      };
    }
    return null;
  };
  // A label's side colour as drawn: a token's ring and plate, an opened plate's left bar, every stamina bar. A selected
  // label's ring and bar are the selection's gold, not its side's.
  const colour = (node, property) => (node ? getComputedStyle(node)[property] : null);
  const coloursOf = (at, plate, selected) => {
    const bars = [...at.querySelectorAll(".mp-plate__stamina > i, .mp-plate__meter > i")].map((bar) => colour(bar, "backgroundColor"));
    const edges = selected
      ? []
      : plate
        ? [colour(plate, "borderLeftColor")]
        : [colour(at.querySelector(".mp-token__disk"), "borderTopColor"), colour(at.querySelector(".mp-token__strip"), "borderTopColor")];
    return [...edges, ...bars].filter(Boolean);
  };
  const things = [...document.querySelectorAll(".mp-at")]
    .filter((at) => at.firstElementChild && shown(at))
    .map((at) => {
      const plate = at.querySelector(".mp-plate");
      const selected = at.dataset.selected === "true";
      return {
        kind: plate ? "plate" : "token",
        key: at.dataset.key,
        open: plate?.dataset.open === "true",
        selected,
        side: at.dataset.relation,
        colours: coloursOf(at, plate, selected),
        text: words(at),
        over: thingOf(at.dataset.key),
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
  // What takes a pointer in the label layer: any element not set to let it through, and each label (the order line
  // too) that a click at its middle would land on.
  const layer = document.querySelector(".mp");
  // The page's three side colours (HUD_SHEET own, ally, enemy), resolved as a drawn colour is.
  const sides = {};
  if (layer)
    for (const side of ["own", "ally", "enemy"]) {
      const probe = document.createElement("i");
      probe.style.color = \`var(--hud-\${side})\`;
      layer.append(probe);
      sides[side] = getComputedStyle(probe).color;
      probe.remove();
    }
  const takers = layer ? [layer, ...layer.querySelectorAll("*")].filter((element) => getComputedStyle(element).pointerEvents !== "none").length : 0;
  const caught = things.flatMap((thing) => {
    const hit = document.elementFromPoint(thing.x + thing.w / 2, thing.y + thing.h / 2);
    return hit && hit.closest(thing.kind === "order line" ? '[role="tooltip"]' : ".mp") ? [thing.text || thing.kind] : [];
  });
  return {
    takers,
    caught,
    world: Boolean((world?.camera && canvas) || lab),
    sides,
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
 * Each label against its thing, as the renderer placed it: how far its foot stands over the thing's model top
 * (`up`, negative where it reaches down onto the model) and whether its span meets the thing's vertical between that top
 * and its label point (`over`), both as drawn: a standing thing leans from its tile toward the screen's sides under the
 * camera's perspective, its label point further still.
 * `off` those that stand on their thing or away from it; `unmeasured` those whose thing was not read in full.
 */
const againstTheirThings = (seen) => {
  const point = (one) => Boolean(one) && Number.isFinite(one.x) && Number.isFinite(one.y);
  // Every label names a thing (the order line names none): each needs its thing's tile, top and label point read.
  const labels = seen.things.filter((thing) => thing.kind !== "order line");
  const resolved = (label) =>
    Boolean(label.over) && point(label.over.tile) && point(label.over.top) && point(label.over.point);
  const standing = labels.filter(resolved).map((label) => ({
    label: label.text || label.kind,
    kind: label.kind,
    up: label.over.top.y - (label.y + label.h),
    over:
      Math.max(label.over.top.x, label.over.point.x) >= label.x &&
      Math.min(label.over.top.x, label.over.point.x) <= label.x + label.w,
  }));
  return {
    standing,
    off: standing.filter((one) => one.up < -ROUNDING_PX || !one.over),
    unmeasured: labels.filter((label) => !resolved(label)).map((label) => label.key ?? label.text ?? label.kind),
  };
};

/**
 * The labels not drawn in their side's colour: three sides (owner, 2026-10-21: "red for everything thats not me, blue
 * for allies ... and green for me"), so an enemy's and nobody's are both the enemy's red. `alike` when the page's three
 * side colours are not three.
 */
const offSide = (seen) => {
  const sides = seen.sides ?? {};
  const alike = new Set([sides.own, sides.ally, sides.enemy]).size < 3 || !sides.own || !sides.ally || !sides.enemy;
  const wanted = (side) => sides[side === "own" || side === "ally" ? side : "enemy"];
  const off = seen.things
    .filter(
      (thing) => thing.kind !== "order line" && (thing.colours ?? []).some((drawn) => drawn !== wanted(thing.side)),
    )
    .map((thing) => ({
      label: thing.text || thing.key,
      side: thing.side,
      colours: thing.colours,
      wanted: wanted(thing.side),
    }));
  return { alike, off };
};

/**
 * A reading's verdict: no label takes a pointer (owner, 2026-10-20: "the label must not be clickable"); every label
 * is drawn in its side's colour, one of three; every label stands above its thing, over it, never on it nor away from it; no token, plate or
 * order line overlaps or crowds another; and, given the reading before anything opened, every opened plate covers where
 * its token was. A view with no label drawn (zoomed out, or off the world) has nothing to judge: blocked, not passed.
 */
export const judgePlates = (seen, before = null) => {
  if (!seen || seen.labels === 0) return blocked("no map label is drawn in view", { seen });
  if (seen.takers > 0 || seen.caught?.length > 0)
    return failed(`labels take pointer input: ${seen.takers} elements, a click caught on ${seen.caught?.length ?? 0}`, {
      seen,
    });
  const sided = offSide(seen);
  if (sided.alike) return failed("the page's three side colours are not three", { seen, sides: seen.sides });
  if (sided.off.length > 0)
    return failed(`${sided.off.length} labels not drawn in their side's colour`, { seen, offSide: sided.off });
  const { standing, off, unmeasured } = againstTheirThings(seen);
  if (off.length > 0) return failed(`${off.length} labels stand on their thing or away from it`, { seen, off });
  const { measured, far } = before ? awayFromTokens(seen, before) : { measured: [], far: [] };
  if (far.length > 0) return failed(`${far.length} opened plates stand away from their thing's token`, { seen, far });
  if (seen.overlaps.length > 0) return failed(`${seen.overlaps.length} pairs overlap`, { seen });
  if (seen.crowded.length > 0)
    return failed(`${seen.crowded.length} pairs stand closer than ${CROWDED_PX}px`, { seen });
  // Missing evidence never passes: a label whose thing was not read (the page reports no world, or not this thing) leaves
  // the reading unproved. The plate lists open the page with the dev overlays, which report the world.
  if (unmeasured.length > 0)
    return blocked(
      seen.world === false
        ? "the page does not report its world (window.__gameRenderer): no label measured against its thing"
        : `${unmeasured.length} of ${standing.length + unmeasured.length} labels not measured against their thing`,
      { seen, unmeasured },
    );
  return completed({
    labels: seen.labels,
    opened: seen.opened,
    tokens: seen.tokens,
    orderLine: seen.orderLine,
    measured,
    standing,
  });
};
