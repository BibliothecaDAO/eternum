/**
 * Every leaderboard's one rule (the owner, 4 November 2026: "now that we have a lot of players they need to see where
 * they stand"): a board shows every place in a scroll area, and the player's own row stays in sight (the stylesheets'
 * `[data-own]` board rows, `position: sticky`): at the area's foot while its place is below the view, at its top (under
 * a table's head) once scrolled past. Pressing it there brings its place into view with its neighbours round it; in
 * its place it does what any row does.
 *
 * Brings the place of the player's own row into the middle of its board's scroll area when that place is out of view,
 * and says whether it did: false when the place already shows (the press is the row's own) or the row scrolls nowhere.
 */
export const revealOwnPlace = (row: HTMLElement): boolean => {
  const area = scrollAreaOf(row);
  if (!area) return false;
  const place = placeOf(row, area);
  // What a table's head covers at the area's top is not in view.
  const head = parseFloat(getComputedStyle(row).getPropertyValue("--ui-table-head")) || 0;
  const top = area.scrollTop + head;
  const height = area.clientHeight - head;
  if (place >= top && place + row.offsetHeight <= top + height) return false;
  area.scrollTo({ top: Math.max(0, place - head - (height - row.offsetHeight) / 2), behavior: "smooth" });
  return true;
};

/** The nearest box the row scrolls in. */
const scrollAreaOf = (row: HTMLElement): HTMLElement | null => {
  for (let box = row.parentElement; box; box = box.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(box).overflowY)) return box;
  }
  return null;
};

/**
 * Where the row's place starts in its area's content, wherever the row itself stands while it waits: the row read
 * where the flow puts it, unstuck for that one read (no frame is drawn between), so margins, gaps and what sticks
 * before it, as a table's head does, count as the layout counts them.
 */
const placeOf = (row: HTMLElement, area: HTMLElement): number => {
  const sticky = row.style.position;
  row.style.position = "static";
  const top = row.getBoundingClientRect().top;
  row.style.position = sticky;
  return top - area.getBoundingClientRect().top + area.scrollTop;
};
