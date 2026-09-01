const LORDS_DECIMALS = 10n ** 18n;

/** Whole-LORDS display with thousands separators; sub-LORDS dust is truncated. */
export const formatLords = (raw: bigint): string => (raw / LORDS_DECIMALS).toLocaleString("en-US");

export const shortAddress = (address: string): string =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

export const formatCountdown = (secondsLeft: number): string => {
  const clamped = Math.max(0, secondsLeft);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
};

export const formatLocalTime = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const formatDate = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toLocaleDateString([], { month: "short", day: "numeric" });

export const ordinal = (rank: number): string => {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rank % 10] ?? "th";
  return `${rank}${suffix}`;
};

export const portraitUrl = (portrait: string | null): string => `/art/avatars/${portrait ?? "01"}.webp`;
