/**
 * The kit's one way to write a number: an amount, a price, a charge, a percent, a rate, a place, points. Every one is
 * written for en-US, whatever the device's language, so "1,250" never reads "1.250". Unknown is a dash, never zero.
 */
import { POINT, POINTS } from "./words";

const exact = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
// Nine places: the resource precision every balance and charge settles to.
const charge = new Intl.NumberFormat("en-US", { maximumFractionDigits: 9 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * A known amount, exact while a player still counts it against a price ("1,250 labor") and compact past ten
 * thousand; an unknown one is "—", never zero.
 */
export const formatAmount = (value: number | undefined): string => {
  if (value === undefined) return "—";
  return Math.abs(value) < 10_000 ? exact.format(value) : compact.format(value);
};

/** A price, and what is held against it, always exact ("10,000 wheat"): the player counts it to the unit. */
export const formatExact = (value: number | undefined): string => (value === undefined ? "—" : exact.format(value));

/**
 * A charge as the chain takes it, to the resource's last unit ("0.05 wheat", "1,000 wheat"): a fraction stays, so a
 * real charge never reads as nothing.
 */
export const formatCharge = (value: number | undefined): string => (value === undefined ? "—" : charge.format(value));

const SIGN = (digits: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("en-US", { ...digits, signDisplay: "exceptZero" });
const WHOLE = { maximumFractionDigits: 0 };
const ONE_PLACE = { maximumFractionDigits: 1 };
const TWO_FIGURES = { maximumSignificantDigits: 2 };
/** Ten and up whole, one to ten with one place, below one two figures: as precise as the number is read. */
const figures = (magnitude: number) => (magnitude >= 10 ? WHOLE : magnitude >= 1 ? ONE_PLACE : TWO_FIGURES);

/**
 * A share as a percent, from its fraction: whole from ten percent up, one place below ("45%", "2.5%"), signed when it is
 * a bonus or a malus ("+10%", "-5%").
 */
export const formatPercent = (fraction: number | undefined, { signed = false } = {}): string => {
  if (fraction === undefined) return "—";
  const percent = fraction * 100;
  const digits = Math.abs(percent) >= 10 ? WHOLE : ONE_PLACE;
  const text = signed ? SIGN(digits).format(percent) : new Intl.NumberFormat("en-US", digits).format(percent);
  return `${text}%`;
};

/**
 * A rate, from its amount a second: a second when it is one or more ("+2.5/s"), a minute below ("+30/min",
 * "+0.6/min"), signed, never an hour. Nothing gained reads "0/min".
 */
export const formatRate = (perSecond: number | undefined): string => {
  if (perSecond === undefined) return "—";
  if (Math.abs(perSecond) >= 1) return `${SIGN(figures(Math.abs(perSecond))).format(perSecond)}/s`;
  const perMinute = perSecond * 60;
  return `${SIGN(figures(Math.abs(perMinute))).format(perMinute)}/min`;
};

const ORDINAL = new Intl.PluralRules("en-US", { type: "ordinal" });
const ORDINAL_ENDINGS: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };

/** A place in a ranking: "1st", "2nd", "23rd", "11th". */
export const formatOrdinal = (place: number | undefined): string =>
  place === undefined ? "—" : `${exact.format(place)}${ORDINAL_ENDINGS[ORDINAL.select(place)]}`;

/** Points, always exact: a player counts them to the unit against the one above. "1 point", "1,250 points". */
export const formatPoints = (points: number | undefined): string =>
  points === undefined ? `— ${POINTS}` : `${exact.format(points)} ${points === 1 ? POINT : POINTS}`;
