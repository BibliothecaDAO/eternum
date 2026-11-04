/**
 * Every leaderboard's one rule (the owner, 4 November 2026: "now that we have a lot of players they need to see where
 * they stand"): a board shows every place in a scroll area, and the player's own row waits at the area's foot while its
 * place is below the view (the stylesheets' `[data-own]` board rows, `position: sticky`). Pressing it there brings its
 * place into view with its neighbours round it; in its place it does what any row does.
 *
 * Brings the place of the player's own row into the middle of its board's scroll area when that place is out of view,
 * and says whether it did: false when the place already shows (the press is the row's own) or the row scrolls nowhere.
 */
export const revealOwnPlace = (row: HTMLElement): boolean => {
  const area = scrollAreaOf(row);
  if (!area) return false;
  const place = placeOf(row, area);
  if (place >= area.scrollTop && place + row.offsetHeight <= area.scrollTop + area.clientHeight) return false;
  area.scrollTo({ top: place - (area.clientHeight - row.offsetHeight) / 2, behavior: "smooth" });
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
 * Where the row's place starts in its area's content: right under the row before it (or its list's top), wherever the
 * row itself stands while it waits at the foot.
 */
const placeOf = (row: HTMLElement, area: HTMLElement): number => {
  const before = row.previousElementSibling;
  const top = before ? before.getBoundingClientRect().bottom : row.parentElement!.getBoundingClientRect().top;
  return top - area.getBoundingClientRect().top + area.scrollTop;
};
