/** Canonical lowercase hex so the allowlist and a resolved identity compare like-for-like. */
export const normalizeAddress = (value: string): string => `0x${BigInt(value).toString(16)}`;
