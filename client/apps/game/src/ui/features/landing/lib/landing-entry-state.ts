export type LandingModeFilter = "blitz" | "season";
type LandingHomeTab = "play" | "learn" | "news" | "factory";

export interface LandingEntryRouteState {
  returnTo?: string;
  landingModeFilter?: LandingModeFilter;
}

const DEFAULT_RETURN_TO = "/";

const resolveReturnTo = (pathname: string, state: LandingEntryRouteState | null | undefined): string => {
  if (!state?.returnTo || state.returnTo === pathname) {
    return DEFAULT_RETURN_TO;
  }

  return state.returnTo;
};

const resolvePathnameFromHref = (href: string): string => {
  try {
    return new URL(href, "https://realms.invalid").pathname;
  } catch {
    return DEFAULT_RETURN_TO;
  }
};

const resolveActiveTab = (pathname: string): LandingHomeTab => {
  if (pathname.startsWith("/learn")) {
    return "learn";
  }

  if (pathname.startsWith("/news")) {
    return "news";
  }

  if (pathname.startsWith("/factory")) {
    return "factory";
  }

  return "play";
};

export const resolveLandingEntryState = ({
  pathname,
  state,
}: {
  pathname: string;
  state: LandingEntryRouteState | null | undefined;
}) => {
  const returnTo = resolveReturnTo(pathname, state);
  const returnPathname = resolvePathnameFromHref(returnTo);

  return {
    activeTab: resolveActiveTab(returnPathname),
    landingModeFilter: state?.landingModeFilter === "season" ? "season" : "blitz",
    returnTo,
  };
};

export const resolveLandingSurfacePath = ({
  pathname,
  state,
}: {
  pathname: string;
  state: LandingEntryRouteState | null | undefined;
}): string => {
  if (!pathname.startsWith("/enter/")) {
    return pathname;
  }

  return resolvePathnameFromHref(resolveReturnTo(pathname, state));
};
