/**
 * The one way to write a number a player reads: an amount, a price, a charge, a percent, a rate, a place, points.
 * Every one is written for en-US, whatever the device's language, so "1,250" never reads "1.250". Unknown is a dash,
 * never zero.
 */
import { RESOURCE_PRECISION } from "../constants/utils";
import { formatCount } from "./count";
import { POINT, POINTS } from "./nouns";

const exact = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
// Nine places: the resource precision every balance and charge settles to, which a typed amount keeps.
const typed = new Intl.NumberFormat("en-US", { maximumFractionDigits: 9 });
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
 * A charge: a cost, a price, an order's amount and total, a swap's debit and credit, a fee, and a reward shown beside
 * them. Rounded, as a player reads it (owner, 10-20: "dont show exact charges"), and written as an amount held is, so a
 * cost and a balance read alike: whole from one ("28 wheat" for 28.15), compact past ten thousand ("12.4K"), and under
 * one "<1" (owner, 10-20: no decimals in a charge or reward), so a real charge never reads as nothing. The chain still
 * takes the exact charge; a short pair says more (formatHeldAgainst).
 */
export const formatCharge = (value: number | undefined): string => formatAmount(value);

const PRECISION = BigInt(RESOURCE_PRECISION);

/**
 * An amount the chain holds at its resource precision, in the units a player reads, exact: 57.6 stays 57.6, so the one
 * rounding is the formatter's and every surface writes the same reward alike ("+58"). The one way from a scaled
 * amount to a number a player reads.
 */
export const scaledToUnits = (scaled: bigint): number =>
  Number(scaled / PRECISION) + Number(scaled % PRECISION) / RESOURCE_PRECISION;

// From whole units to the resource's last unit: the precisions a short pair steps through until its two sides differ.
const PAIR_PRECISIONS = Array.from(
  { length: 10 },
  (_, places) => new Intl.NumberFormat("en-US", { maximumFractionDigits: places }),
);

/**
 * What is held against what is needed ("28 / 30", "Needs 15K labor, have 9,640"), both rounded as a charge reads, so the
 * pair reads as the comparison it is. Rounding never makes a covered pair read short; a short one it would write equal
 * ("28 / 28" for 28.10 of 28.15, "12.4K / 12.4K", "0.56 / 0.56") is written at the first precision that tells the two
 * apart ("28.1 / 28.2"), so a shortfall never reads as met. Unknown held is "—".
 */
export const formatHeldAgainst = (held: number | undefined, need: number): { held: string; need: string } => {
  const rounded = { held: formatCharge(held), need: formatCharge(need) };
  if (held === undefined || held >= need || rounded.held !== rounded.need) return rounded;
  const precise = PAIR_PRECISIONS.find((writer) => writer.format(held) !== writer.format(need)) ?? typed;
  return { held: precise.format(held), need: precise.format(need) };
};

/**
 * The number an amount field shows: what the player typed or set, exact to the resource's last unit ("1,234.5"), never
 * rounded, as the transaction will carry it.
 */
export const formatTypedNumber = (value: number): string => typed.format(value);

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

/** A count read off the chain or a holding's metadata, written whole: unknown or below zero is none. */
const wholeCount = (value: number) => exact.format(Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);

/**
 * A realm's population, the one way every screen writes it, Blitz's and Frontier's alike: what its buildings take of
 * all it can hold, "5/6". Never what is free; a shortfall says that in its own line.
 */
export const formatPopulation = (used: number, capacity: number): string =>
  `${wholeCount(used)}/${wholeCount(capacity)}`;

/** The same in words, on a hover or in a line: "Population 5 of 6". */
export const formatPopulationInWords = (used: number, capacity: number): string =>
  `Population ${wholeCount(used)} of ${wholeCount(capacity)}`;
