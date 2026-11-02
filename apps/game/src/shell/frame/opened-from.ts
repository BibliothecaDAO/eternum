/** What a link puts in the history entry of a page it opens from a list: the list's address. */
type OpenedFrom = { from: string };

/** The state that marks the opened page as opened from this list. */
export const openedFrom = (here: { pathname: string; search: string }): OpenedFrom => ({
  from: `${here.pathname}${here.search}`,
});

/** Whether a page was opened from another page's list, rather than arrived at directly (after a match, from Play). */
export const isOpenedFrom = (location: { state: unknown }): boolean => {
  const from = (location.state as Partial<OpenedFrom> | null)?.from;
  return typeof from === "string" && from.startsWith("/");
};
