import { blocked, completed, failed } from "./evidence.mjs";

/**
 * The in-game HUD's layout as a page draws it, every mode's, and the one judgement of it: the playtest reads it on a
 * live map (`hud-layout`), the HUD lab's runner on the lab's states (`capture:hud-lab --hud-layout`).
 *
 * Every part the player sees is read, whatever the mode puts in it: each panel, pill, round order, notice and docked
 * sheet the HUD draws (the HUD sheet's elements: .ui-panel, .ui-pill, .ui-bubble, .ui-notice), a part inside another
 * read as that one, a part not drawn (absent, empty, hidden) left out. Each is named for what it says it is. Each
 * part's enabled controls are hit-tested: a point near each end and at the centre of every one must reach that control,
 * not something drawn over it. The minimap is read by name: a desktop must draw it. Each of the HUD's regions (issue
 * 5067's top bar, holdings column, rail and commands) counts the parts drawn in it.
 */
export const HUD_LAYOUT_EXPRESSION = `JSON.stringify((() => {
  const shown = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  };
  const box = (rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
  const PART = ".ui-panel, .ui-pill, .ui-bubble, .ui-notice, [data-kit-sheet]";
  const candidates = [...document.querySelectorAll(PART)].filter((element) => shown(element));
  const outermost = candidates.filter((element) => !candidates.some((other) => other !== element && other.contains(element)));
  const nameOf = (element) =>
    element.getAttribute("aria-label") ||
    element.querySelector(".ui-panel__title, .ui-bubble__word")?.textContent.trim() ||
    element.textContent.trim().slice(0, 24) ||
    element.className.split(" ").find((name) => name.startsWith("ui-")) ||
    element.tagName.toLowerCase();
  const parts = {};
  const covered = [];
  for (const element of outermost) {
    let name = nameOf(element);
    for (let index = 2; parts[name]; index += 1) name = nameOf(element) + " " + index;
    parts[name] = box(shown(element));
    for (const control of element.querySelectorAll("button:not([disabled]), input:not([disabled]), textarea, select, a[href]")) {
      const at = shown(control);
      if (!at || at.right < 0 || at.bottom < 0 || at.left > innerWidth || at.top > innerHeight) continue;
      const y = at.top + at.height / 2;
      const points = [[at.left + 3, y], [at.left + at.width / 2, y], [at.right - 3, y]];
      const reached = points.every(([x, py]) => {
        const hit = document.elementFromPoint(x, py);
        return hit === control || control.contains(hit);
      });
      if (!reached) covered.push(name + ": " + (control.getAttribute("aria-label") || control.textContent.trim().slice(0, 24)));
    }
  }
  const minimap = shown(document.querySelector('section[aria-label="Minimap"]'));
  const REGIONS = {
    "top bar": 'header[aria-label="Game controls"]',
    holdings: "[data-hud-column]:not([data-hud-rail])",
    rail: "[data-hud-rail]",
    commands: "[data-hud-foot]",
  };
  const regions = {};
  for (const [region, selector] of Object.entries(REGIONS)) {
    const homes = [...document.querySelectorAll(selector)].filter((home) => shown(home));
    if (homes.length > 0) regions[region] = outermost.filter((element) => homes.some((home) => home.contains(element))).length;
  }
  return { viewport: { width: innerWidth, height: innerHeight }, parts, minimap: minimap ? box(minimap) : null, covered, regions };
})())`;

/** The desktop width the HUD lays out its left column from (DESKTOP_MIN_PX). */
const DESKTOP_MIN_WIDTH = 1024;

/** The most parts one region holds: the working limit of things a player keeps in mind at once. */
const MOST_PARTS_IN_A_REGION = 7;

/**
 * A layout is right when some part is drawn and, on a desktop, the minimap; every drawn part lies whole on the page; no
 * two drawn parts lie over each other; every control of every part takes its own clicks; and no region holds more than
 * seven parts.
 */
export function judgeHudLayout(layout) {
  const { viewport, parts = {}, minimap = null, covered = [], regions = {} } = layout ?? {};
  if (!viewport) return blocked("the HUD's layout was not read");
  if (Object.keys(parts).length === 0) return failed("no HUD part drawn", { layout });
  if (viewport.width >= DESKTOP_MIN_WIDTH && !minimap) return failed("not drawn: the minimap", { layout });
  const drawn = Object.entries(parts);
  const outside = drawn.filter(
    ([, box]) => box.left < 0 || box.top < 0 || box.right > viewport.width || box.bottom > viewport.height,
  );
  const overlaps = drawn.flatMap(([name, box], index) =>
    drawn
      .slice(index + 1)
      .filter(([, other]) => overlap(box, other))
      .map(([other]) => `${name} over ${other}`),
  );
  const crowded = Object.entries(regions).filter(([, count]) => count > MOST_PARTS_IN_A_REGION);
  const faults = [
    ...(outside.length > 0 ? [`off the page: ${outside.map(([name]) => name).join(", ")}`] : []),
    ...(overlaps.length > 0 ? [`overlapping: ${overlaps.join(", ")}`] : []),
    ...(covered.length > 0 ? [`covered controls: ${covered.join(", ")}`] : []),
    ...(crowded.length > 0
      ? [`more than seven parts: ${crowded.map(([region, count]) => `${region} (${count})`).join(", ")}`]
      : []),
  ];
  return faults.length > 0 ? failed(faults.join("; "), { layout }) : completed({ layout });
}

/** Two boxes share more than a hairline (a border's pixel). */
const overlap = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
