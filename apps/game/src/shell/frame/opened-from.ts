/** What a link puts in the history entry of a page it opens from a list: where that page's Back leads. */
type OpenedFrom = { back: string };

/** The state that makes the opened page lead Back here. */
export const openedFrom = (here: { pathname: string; search: string }): OpenedFrom => ({
  back: `${here.pathname}${here.search}`,
});

const backOf = (state: unknown): string | null => {
  const back = (state as Partial<OpenedFrom> | null)?.back;
  return typeof back === "string" && back.startsWith("/") ? back : null;
};

/** Whether a page was opened from another page's list (it then leads Back there), rather than arrived at directly. */
export const isOpenedFrom = (location: { state: unknown }): boolean => backOf(location.state) !== null;

/** Where Back leads on a page opened from another: the page that opened it, else `fallback`. */
export const backFrom = (location: { state: unknown }, fallback: string): string => backOf(location.state) ?? fallback;
