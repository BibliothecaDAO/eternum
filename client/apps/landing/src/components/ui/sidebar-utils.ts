const SIDEBAR_COOKIE_NAME = "sidebar:state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type SidebarOpenUpdater = boolean | ((value: boolean) => boolean);

export function resolveNextSidebarOpen(currentOpen: boolean, updater: SidebarOpenUpdater): boolean {
  if (typeof updater === "function") {
    return updater(currentOpen);
  }
  return updater;
}

export function buildSidebarCookie(nextOpen: boolean): string {
  return `${SIDEBAR_COOKIE_NAME}=${nextOpen}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
}
