type LocationLike = Pick<Location, "pathname" | "search">;

const LEGACY_HOME_TAB_TO_PATH: Record<string, string> = {
  play: "/",
  learn: "/learn",
  news: "/news",
  factory: "/factory",
};

export const resolveLegacyLandingHref = (location: LocationLike): string | null => {
  if (location.pathname !== "/") {
    return null;
  }

  const searchParams = new URLSearchParams(location.search);
  const tab = searchParams.get("tab");
  if (!tab) {
    return null;
  }

  const destination = LEGACY_HOME_TAB_TO_PATH[tab];
  if (!destination) {
    return null;
  }

  searchParams.delete("tab");
  const remainingQuery = searchParams.toString();
  return remainingQuery ? `${destination}?${remainingQuery}` : destination;
};
