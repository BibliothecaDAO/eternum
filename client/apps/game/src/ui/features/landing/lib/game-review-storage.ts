import type { Chain } from "@contracts";

const REVIEW_DISMISSED_PREFIX = "eternum:review:dismissed";

const getReviewDismissedKey = (chain: Chain, worldName: string): string =>
  `${REVIEW_DISMISSED_PREFIX}:${chain}:${worldName.toLowerCase()}`;

export const isGameReviewDismissed = (chain: Chain, worldName: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getReviewDismissedKey(chain, worldName)) === "1";
  } catch {
    return false;
  }
};

export const setGameReviewDismissed = (chain: Chain, worldName: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getReviewDismissedKey(chain, worldName), "1");
  } catch {
    // ignore storage failures
  }
};
