/**
 * The HUD's side columns mark themselves with this attribute. The map runs on under them, so a world label anchored on
 * the open map but reaching under a column would be cut by it; it shifts sideways to clear the column instead. A label
 * anchored under a column stays put: its object is hidden there too.
 */
const HUD_COLUMN_ATTRIBUTE = "data-hud-column";

/** Spread on a HUD side column's element to mark it. */
export const HUD_COLUMN_MARK = { [HUD_COLUMN_ATTRIBUTE]: "" };

/** No label is wider than twice this, so one anchored farther from a column never reaches under it. */
const WIDEST_HALF_LABEL_PX = 240;

/** Shifts each world label that reaches under a HUD column back beside it; called after the labels are placed. */
export function keepLabelsBesideHudColumns(labels: HTMLElement, root: ParentNode = document): void {
  const columns = [...root.querySelectorAll(`[${HUD_COLUMN_ATTRIBUTE}]`)].map((column) =>
    column.getBoundingClientRect(),
  );
  for (const label of labels.children) {
    if (!(label instanceof HTMLElement)) continue;
    const anchor = labelAnchor(label);
    const shift = anchor ? clearance(anchor, columns, () => label.offsetWidth / 2) : 0;
    label.style.translate = shift ? `${shift}px 0` : "";
  }
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
