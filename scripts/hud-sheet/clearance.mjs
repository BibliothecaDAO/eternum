/**
 * The desktop HUD's bottom-left rule, read off a page (`capture:hud-lab`'s blitz-hud surface): the minimap sits in the
 * left column's bottom-left corner whatever the column above it holds; the column's panels never overlap; and the
 * foot's bubbles stay between the two columns, clear of both.
 */

/** Evaluated in the page: the left column, its panels and the foot's items, as boxes in CSS pixels. */
export const READ_HUD_BOXES = `(() => {
  const box = (element) => {
    const rect = element.getBoundingClientRect();
    const name = element.getAttribute("aria-label") || element.tagName.toLowerCase();
    return { name, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  };
  const column = document.querySelector('[data-hud-column][aria-label="Holdings"]');
  const foot = document.querySelector("[data-hud-foot]");
  return {
    viewport: { width: innerWidth, height: innerHeight },
    column: column ? box(column) : null,
    panels: column ? [...column.children].map(box) : [],
    foot: foot ? [...foot.children].map(box) : [],
  };
})()`;

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const at = ({ left, bottom }) => `(${Math.round(left)}, ${Math.round(bottom)})`;

/** What breaks the rule, one line each; none when the HUD keeps it. */
export const hudClearanceProblems = ({ viewport, column, panels, foot }) => {
  if (!column) return ["no left column"];
  const problems = [];
  const minimap = panels.find(({ name }) => name === "Minimap");
  if (!minimap) problems.push("no minimap");
  else if (Math.abs(minimap.left - column.left) > 0.5 || Math.abs(minimap.bottom - column.bottom) > 0.5) {
    problems.push(`the minimap's corner ${at(minimap)} is not the column's bottom-left ${at(column)}`);
  }
  panels.forEach((panel, index) =>
    panels.slice(index + 1).forEach((other) => {
      if (overlaps(panel, other)) problems.push(`${panel.name} overlaps ${other.name}`);
    }),
  );
  // The right rail mirrors the left column, so the room between them ends as far from the right edge.
  const room = { left: column.right, right: viewport.width - column.right };
  foot.forEach((item) => {
    if (item.left < room.left - 0.5 || item.right > room.right + 0.5) {
      problems.push(
        `the foot's ${item.name} (${Math.round(item.left)}–${Math.round(item.right)}) leaves the room between the columns (${Math.round(room.left)}–${Math.round(room.right)})`,
      );
    }
  });
  return problems;
};
