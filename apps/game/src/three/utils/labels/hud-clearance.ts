/**
 * The HUD's side columns mark themselves with this attribute. The map runs on under them, so a world label anchored on
 * the open map but reaching under a column would be cut by it; it shifts sideways to clear the column instead. A label
 * anchored under a column stays put: its object is hidden there too.
 */
const HUD_COLUMN_ATTRIBUTE = "data-hud-column";

/** Spread on a HUD side column's element to mark it. */
export const HUD_COLUMN_MARK = { [HUD_COLUMN_ATTRIBUTE]: "" };

/** The HUD's foot (the order bubbles between the columns) marks itself with this attribute; labels pass under it. */
const HUD_FOOT_ATTRIBUTE = "data-hud-foot";

/** Spread on the HUD's foot element to mark it. */
export const HUD_FOOT_MARK = { [HUD_FOOT_ATTRIBUTE]: "" };

/** A phone's top band (the strip and Next up) marks itself with this attribute: the open map starts under it. */
const HUD_TOP_ATTRIBUTE = "data-hud-top";

/** Spread on the HUD's top band to mark it. */
export const HUD_TOP_MARK = { [HUD_TOP_ATTRIBUTE]: "" };

/** A rectangle on screen, in CSS pixels. */
interface ScreenArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The map's open area on screen, where what the HUD sends the camera to stays in sight: between the side columns, below
 * their tops and a phone's top band, and above the foot (the order bubbles; a phone's action row, dock and place bar).
 * The whole viewport where the HUD marks nothing.
 */
export function openMapArea(viewport: { width: number; height: number }, root: ParentNode = document): ScreenArea {
  const middle = viewport.width / 2;
  const columns = [...root.querySelectorAll(`[${HUD_COLUMN_ATTRIBUTE}]`)].map((column) =>
    column.getBoundingClientRect(),
  );
  const feet = [...root.querySelectorAll(`[${HUD_FOOT_ATTRIBUTE}]`)].map((foot) => foot.getBoundingClientRect());
  const tops = [...root.querySelectorAll(`[${HUD_TOP_ATTRIBUTE}]`)].map((top) => top.getBoundingClientRect().bottom);
  return {
    left: Math.max(0, ...columns.filter((column) => column.right <= middle).map((column) => column.right)),
    right: Math.min(viewport.width, ...columns.filter((column) => column.left >= middle).map((column) => column.left)),
    top: Math.max(columns.length > 0 ? Math.max(0, Math.min(...columns.map((column) => column.top))) : 0, ...tops),
    bottom: Math.min(viewport.height, ...feet.map((foot) => foot.top)),
  };
}

/** Whether a point on screen stands in the map's open area: what the HUD sends the camera to is already in sight there. */
export const inOpenMapArea = (
  point: { x: number; y: number },
  viewport: { width: number; height: number },
): boolean => {
  const area = openMapArea(viewport);
  return point.x >= area.left && point.x <= area.right && point.y >= area.top && point.y <= area.bottom;
};

/** The HUD's side columns on screen. */
export const hudColumnRects = (root: ParentNode = document): DOMRect[] =>
  [...root.querySelectorAll(`[${HUD_COLUMN_ATTRIBUTE}]`)].map((column) => column.getBoundingClientRect());

/** No label is wider than twice this, so one anchored farther from a column never reaches under it. */
const WIDEST_HALF_LABEL_PX = 240;

/**
 * Shifts each world label that reaches under a HUD column back beside it; called after the labels are placed. Every
 * read (the columns, the labels' widths) comes before the first write, so the browser lays the page out once per call,
 * not once per label, under any HUD that marks its columns.
 */
export function keepLabelsBesideHudColumns(labels: HTMLElement, root: ParentNode = document): void {
  const columns = hudColumnRects(root);
  const shifts: Array<[HTMLElement, string]> = [];
  for (const label of labels.children) {
    if (!(label instanceof HTMLElement)) continue;
    const anchor = labelAnchor(label);
    const shift = anchor ? clearance(anchor, columns, () => label.offsetWidth / 2) : 0;
    shifts.push([label, shift ? `${shift}px 0` : ""]);
  }
  for (const [label, translate] of shifts) if (label.style.translate !== translate) label.style.translate = translate;
}

/** Where CSS2DRenderer anchored a label: the pixel offset in its last translate. */
const labelAnchor = (label: HTMLElement): { x: number; y: number } | null => {
  const offsets = [...label.style.transform.matchAll(/translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/g)];
  const last = offsets.at(-1);
  return last ? { x: Number(last[1]), y: Number(last[2]) } : null;
};

/** How far a label centred on `anchor` moves to clear the columns beside it: right of a left one, left of a right one. */
const clearance = (anchor: { x: number; y: number }, columns: DOMRect[], halfWidth: () => number): number => {
  for (const column of columns) {
    if (anchor.y < column.top || anchor.y > column.bottom) continue;
    if (anchor.x >= column.left && anchor.x <= column.right) return 0;
    const beside = anchor.x > column.right ? anchor.x - column.right : column.left - anchor.x;
    if (beside >= WIDEST_HALF_LABEL_PX) continue;
    const reach = halfWidth() - beside;
    if (reach > 0) return anchor.x > column.right ? reach : -reach;
  }
  return 0;
};
