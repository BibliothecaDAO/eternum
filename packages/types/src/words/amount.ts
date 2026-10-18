/**
 * The one way to write a number a player reads: an amount, a price, a charge, a percent, a rate, a place, points.
 * Every one is written for en-US, whatever the device's language, so "1,250" never reads "1.250". Unknown is a dash,
 * never zero.
 */
import { formatCount } from "./count";
import { POINT, POINTS } from "./nouns";

const exact = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
// Nine places: the resource precision every balance and charge settles to.
const charge = new Intl.NumberFormat("en-US", { maximumFractionDigits: 9 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * A known amount, exact while a player still counts it against a price ("1,250 labor") and compact past ten
 * thousand; one held but under a unit is "<1", so it never reads as nothing; an unknown one is "—", never zero.
 */
export const formatAmount = (value: number | undefined): string => {
  if (value === undefined) return "—";
  if (value !== 0 && Math.abs(value) < 1) return value < 0 ? "-<1" : "<1";
  return Math.abs(value) < 10_000 ? exact.format(value) : compact.format(value);
};

/**
 * A whole count, exact at any size ("10,000 wheat held", "12 donkeys"), a bigint past Number's range included: it rounds
 * to the unit, so never a price, a cost or anything a transaction moves; those are charges (formatCharge).
 */
export const formatExact = (value: number | bigint | undefined): string =>
  value === undefined ? "—" : exact.format(value);

/**
 * A charge: a price, a cost, an order's amount and total, a swap's debit and credit, a fee. Written as the chain takes
 * it, exact at any size and to the resource's last unit ("0.25 LORDS", "12,400 wheat"), so a real charge never reads
 * as nothing or as a rounded figure.
 */
export const formatCharge = (value: number | undefined): string => (value === undefined ? "—" : charge.format(value));

const TYPED_WHOLE = /[+-]?[0-9,]+/;
const TYPED_DECIMAL = /[+-]?(?:[0-9,]+(?:[.][0-9]*)?|[.][0-9]+)/;

/**
 * The number part of what a player typed into an amount field: a sign, digits, thousands commas and, unless whole, a
 * fraction ("1,250.5", "0." while it is typed). Undefined when the text holds none.
 */
export const typedNumberText = (text: string, { whole = false } = {}): string | undefined =>
  text.match(whole ? TYPED_WHOLE : TYPED_DECIMAL)?.[0];

/**
 * The number a player typed, read as they wrote it: commas group, a point starts the fraction, and a whole field keeps
 * the whole part ("1.5" is 1). Nothing typed is null; text that holds no number is NaN.
 */
export const readTypedNumber = (text: string, { whole = false } = {}): number | null => {
  if (text.trim() === "") return null;
  const typed = typedNumberText(text, { whole });
  if (typed === undefined) return Number.NaN;
  const value = Number.parseFloat(typed.replace(/,/g, ""));
  return whole ? Math.floor(value) : value;
};

const SIGN = (digits: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("en-US", { ...digits, signDisplay: "exceptZero" });
const WHOLE = { maximumFractionDigits: 0 };
const ONE_PLACE = { maximumFractionDigits: 1 };
const TWO_FIGURES = { maximumSignificantDigits: 2 };
/** Ten and up whole, one to ten with one place, below one two figures: as precise as the number is read. */
const figures = (magnitude: number) => (magnitude >= 10 ? WHOLE : magnitude >= 1 ? ONE_PLACE : TWO_FIGURES);

/**
 * A figure that is not an amount held, written as precisely as it is read: whole from ten, one place from one, two
 * figures below ("12", "2.5", "0.25"), signed when it is a change ("+2.5").
 */
export const formatFigure = (value: number | undefined, { signed = false } = {}): string => {
  if (value === undefined) return "—";
  const digits = figures(Math.abs(value));
  return signed ? SIGN(digits).format(value) : new Intl.NumberFormat("en-US", digits).format(value);
};

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
  if (Math.abs(perSecond) >= 1) return `${formatFigure(perSecond, { signed: true })}/s`;
  return `${formatFigure(perSecond * 60, { signed: true })}/min`;
};

const ORDINAL = new Intl.PluralRules("en-US", { type: "ordinal" });
const ORDINAL_ENDINGS: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };

/** A place in a ranking: "1st", "2nd", "23rd", "11th". */
export const formatOrdinal = (place: number | undefined): string =>
  place === undefined ? "—" : `${exact.format(place)}${ORDINAL_ENDINGS[ORDINAL.select(place)]}`;

/** Points, always exact: a player counts them to the unit against the one above. "1 point", "1,250 points". */
export const formatPoints = (points: number | undefined): string =>
  points === undefined ? `— ${POINTS}` : formatCount(points, POINT, POINTS);
