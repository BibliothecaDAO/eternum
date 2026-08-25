import type { Chain } from "@contracts";

const REVIEW_DISMISSED_STORAGE_KEY = "eternum:review:dismissed";
const sessionDismissedReviews = new Set<string>();

type DismissedReviewMap = Record<string, 1>;

const normalizeWorldAddress = (worldAddress: string): string | null => {
  const trimmed = worldAddress.trim();
  if (!trimmed) return null;

  try {
    const asBigInt = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? BigInt(trimmed) : BigInt(trimmed);
    if (asBigInt <= 0n) return null;
    return `0x${asBigInt.toString(16)}`;
  } catch {
    return null;
  }
};

const getReviewDismissedIdentifier = (chain: Chain, worldAddress: string): string | null => {
  const normalizedAddress = normalizeWorldAddress(worldAddress);
  if (!normalizedAddress) {
    return null;
  }

  return `${chain}:${normalizedAddress}`;
};

const readDismissedMap = (): DismissedReviewMap => {
  const raw = window.localStorage.getItem(REVIEW_DISMISSED_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<DismissedReviewMap>((accumulator, [key, value]) => {
      if (value === 1 || value === "1" || value === true) {
        accumulator[key] = 1;
      }
      return accumulator;
    }, {});
  } catch {
    return {};
  }
};

const writeDismissedMap = (dismissedMap: DismissedReviewMap): void => {
  window.localStorage.setItem(REVIEW_DISMISSED_STORAGE_KEY, JSON.stringify(dismissedMap));
};

export const isGameReviewDismissed = (chain: Chain, worldAddress: string): boolean => {
  const identifier = getReviewDismissedIdentifier(chain, worldAddress);
  if (!identifier) {
    return false;
  }

  if (sessionDismissedReviews.has(identifier)) {
    return true;
  }

  if (typeof window === "undefined") return false;
  try {
    const dismissedMap = readDismissedMap();
    const dismissed = dismissedMap[identifier] === 1;
    if (dismissed) {
      sessionDismissedReviews.add(identifier);
    }
    return dismissed;
  } catch {
    return false;
  }
};

export const setGameReviewDismissed = (chain: Chain, worldAddress: string): void => {
  const identifier = getReviewDismissedIdentifier(chain, worldAddress);
  if (!identifier) {
    return;
  }

  sessionDismissedReviews.add(identifier);

  if (typeof window === "undefined") return;
  try {
    const dismissedMap = readDismissedMap();
    if (dismissedMap[identifier] === 1) {
      return;
    }

    dismissedMap[identifier] = 1;
    writeDismissedMap(dismissedMap);
  } catch {
    // ignore storage failures
  }
};
