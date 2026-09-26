/** A countdown as the Frontier HUD shows it, "7:12:04", one fixed shape so it can tick every second without jumping. */
export const formatClock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
};

/** A countdown at card scale (design §3.12): "3:59" in hours and minutes, "4:07" in minutes and seconds under an hour. */
export const formatShortClock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  if (whole < 3600) return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  return `${Math.floor(whole / 3600)}:${String(Math.floor((whole % 3600) / 60)).padStart(2, "0")}`;
};

/** Time left on a countdown chip: whole days once it is two days or more away ("12d"), the clock under that. */
export const formatTimeLeft = (seconds: number): string =>
  seconds >= 2 * 86_400 ? `${Math.floor(seconds / 86_400)}d` : formatShortClock(seconds);

const exact = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * A known amount, exact while a player still counts it against a price ("1,250 labor") and compact past ten
 * thousand; an unknown one is "—", never zero.
 */
export const formatAmount = (value: number | undefined): string => {
  if (value === undefined) return "—";
  return Math.abs(value) < 10_000 ? exact.format(value) : compact.format(value);
};
