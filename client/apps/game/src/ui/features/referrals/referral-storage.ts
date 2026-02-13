const REFERRAL_STORAGE_KEY = "eternum-referral-address";
const REFERRAL_PARAM = "ref";

export const isValidReferralAddress = (value: string): boolean => /^0x[a-fA-F0-9]{1,64}$/.test(value);

export const normalizeReferralAddress = (value: string): string => `0x${value.trim().toLowerCase().replace(/^0x/, "")}`;

export const parseReferralAddressFromUrl = (url?: string): string | null => {
  const href =
    url ??
    (() => {
      if (typeof window === "undefined") {
        return undefined;
      }
      return window.location.href;
    })();

  if (!href) {
    return null;
  }

  try {
    const parsed = new URL(href);
    const referral = parsed.searchParams.get(REFERRAL_PARAM);

    if (!referral || !isValidReferralAddress(referral)) {
      return null;
    }

    return normalizeReferralAddress(referral);
  } catch {
    return null;
  }
};

export const saveReferralAddress = (referralAddress: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (!isValidReferralAddress(referralAddress)) {
    return;
  }

  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, normalizeReferralAddress(referralAddress));
  } catch {
    // Ignore storage failures.
  }
};

export const getStoredReferralAddress = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!stored || !isValidReferralAddress(stored)) {
      return null;
    }

    return normalizeReferralAddress(stored);
  } catch {
    return null;
  }
};

export const clearStoredReferralAddress = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const createReferralLink = (referrerAddress: string, baseUrl?: string): string => {
  const origin =
    baseUrl ??
    (() => {
      if (typeof window === "undefined") {
        return "";
      }
      return window.location.origin;
    })();

  const normalized = normalizeReferralAddress(referrerAddress);
  return `${origin}/?ref=${normalized}`;
};
