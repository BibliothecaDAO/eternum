export const normalizeAvatarAddress = (value?: string | bigint | number | null): string | null => {
  if (value === null || value === undefined) return null;

  const normalizeString = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
    const lower = trimmed.toLowerCase();

    const normalizeFromBigInt = (input: string): string | null => {
      try {
        const asBigInt = BigInt(input);
        if (asBigInt < 0n) return null;
        return `0x${asBigInt.toString(16)}`;
      } catch {
        return null;
      }
    };

    if (lower.startsWith("0x")) {
      if (!/^0x[0-9a-f]+$/.test(lower)) return lower;
      return normalizeFromBigInt(lower);
    }

    if (/^[0-9]+$/.test(lower)) {
      return normalizeFromBigInt(lower);
    }

    if (/^[0-9a-f]+$/.test(lower)) {
      return normalizeFromBigInt(`0x${lower}`);
    }

    return lower;
  };

  if (typeof value === "bigint") {
    if (value < 0n) return null;
    return `0x${value.toString(16)}`;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return `0x${Math.trunc(value).toString(16)}`;
  }

  return normalizeString(value);
};

const getDefaultAvatar = (key: string): string => {
  const hash = Array.from(key).reduce((current, character) => (current * 31 + character.charCodeAt(0)) >>> 0, 0);
  const avatarNumber = (hash % 7) + 1;
  return `/images/avatars/${String(avatarNumber).padStart(2, "0")}.png`;
};

export const getAvatarUrl = (key: string, customAvatarUrl?: string | null): string =>
  customAvatarUrl || getDefaultAvatar(key);
