const SPECTATE_PARAM = "spectate";
const SPECTATE_VALUE = "true";

const parseWithBase = (url: string): URL => {
  if (typeof window !== "undefined") {
    return new URL(url, window.location.origin);
  }

  return new URL(url, "http://localhost");
};

const readSpectateFromSearch = (search: string): boolean => {
  const params = new URLSearchParams(search);
  return params.get(SPECTATE_PARAM) === SPECTATE_VALUE;
};

export const readSpectateFromWindow = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return readSpectateFromSearch(window.location.search);
};

export const withSpectateParam = (url: string, isSpectating: boolean): string => {
  const parsed = parseWithBase(url);

  if (isSpectating) {
    parsed.searchParams.set(SPECTATE_PARAM, SPECTATE_VALUE);
  } else {
    parsed.searchParams.delete(SPECTATE_PARAM);
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

export const writeSpectateToCurrentUrl = (isSpectating: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }

  const next = withSpectateParam(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
    isSpectating,
  );
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (next !== current) {
    window.history.replaceState(window.history.state, "", next);
  }
};
