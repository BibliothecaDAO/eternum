import { hash, shortString } from "starknet";

/**
 * The season's days, as contracts/l3/world-native/src/days.cairo finds them. A normal day lasts 2 to 6 units of the preset's
 * day unit; days come in bags of five holding each length once, so a bag lasts 20 units. Bag b's order is drawn from
 * the game's seed, so every player shares one schedule.
 */
export const DAYS_PER_BAG = 5;
export const DAY_UNITS_PER_BAG = 20;
const BAG_ORDERS = 96n;
const DAY_BAG = BigInt(shortString.encodeShortString("day bag"));

export interface SeasonCalendar {
  seed: bigint;
  startMainAt: number;
  endAt: number;
  dayUnitSeconds: number;
}

/** One day of the season: its index from the season's start, and its bounds in seconds, end excluded. */
interface SeasonDay {
  index: number;
  start: number;
  end: number;
}

/**
 * A bag order in [0, 96) builds the bag by inserting the lengths one at a time: 4 beside 3, then 5, then 6 anywhere,
 * and last the 2-unit day after one of the long days, so no bag opens with the short day.
 */
export const orderLengths = (order: number): number[] => {
  const bag = [3];
  bag.splice(order % 2, 0, 4);
  bag.splice(Math.floor(order / 2) % 3, 0, 5);
  bag.splice(Math.floor(order / 6) % 4, 0, 6);
  bag.splice(1 + Math.floor(order / 24), 0, 2);
  return bag;
};

// A season has a few dozen bags; each is drawn once per seed.
const drawnBags = new Map<string, number[]>();

/** A bag's five day lengths, in units, in order: the bag order its seed draws. */
export const bagLengths = (seed: bigint, bag: number): number[] => {
  const key = `${seed}:${bag}`;
  let lengths = drawnBags.get(key);
  if (!lengths) {
    const draw = BigInt(hash.computePoseidonHashOnElements([seed, DAY_BAG, BigInt(bag)]));
    lengths = orderLengths(Number(draw % BAG_ORDERS));
    drawnBags.set(key, lengths);
  }
  return lengths;
};

/** The day `timestamp` falls in, or null outside the season. A final stub under two units joins the preceding day. */
export const dayOf = (calendar: SeasonCalendar, timestamp: number): SeasonDay | null => {
  const { startMainAt, dayUnitSeconds: unit } = calendar;
  if (!Number.isSafeInteger(unit) || unit <= 0) throw new Error("A season's day unit must be positive");
  if (!Number.isSafeInteger(startMainAt) || !Number.isSafeInteger(calendar.endAt) || calendar.endAt <= startMainAt)
    throw new Error("A season must have a positive, finite window");
  if (timestamp < startMainAt || timestamp >= calendar.endAt) return null;
  // The last two units belong to the day already running at their start, absorbing a shorter final stub.
  const seasonUnits = Math.floor((calendar.endAt - startMainAt) / unit);
  const finalDayProbe = seasonUnits - Math.min(seasonUnits, 2);
  const at = Math.min(Math.floor((timestamp - startMainAt) / unit), finalDayProbe);
  const bag = Math.floor(at / DAY_UNITS_PER_BAG);
  let start = bag * DAY_UNITS_PER_BAG;
  let index = bag * DAYS_PER_BAG;
  for (const length of bagLengths(calendar.seed, bag)) {
    const end = start + length;
    if (at < end)
      return {
        index,
        start: startMainAt + start * unit,
        end: end > finalDayProbe ? calendar.endAt : startMainAt + end * unit,
      };
    start = end;
    index += 1;
  }
  throw new Error("A bag's days cover the bag");
};

/** Resolve a persisted allocation day through the same calendar, including its clipped final day. */
export const dayAtIndex = (calendar: SeasonCalendar, index: number): SeasonDay => {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("Invalid day index");
  const bag = Math.floor(index / DAYS_PER_BAG);
  const units =
    bag * DAY_UNITS_PER_BAG +
    bagLengths(calendar.seed, bag)
      .slice(0, index % DAYS_PER_BAG)
      .reduce((sum, length) => sum + length, 0);
  const day = dayOf(calendar, calendar.startMainAt + units * calendar.dayUnitSeconds);
  if (!day || day.index !== index) throw new Error("Day index outside season");
  return day;
};

/** How long a season of whole bags lasts, in seconds. */
export const seasonSeconds = (seasonBags: number, dayUnitSeconds: number): number =>
  seasonBags * DAY_UNITS_PER_BAG * dayUnitSeconds;
