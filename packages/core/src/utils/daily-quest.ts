import { hash, shortString } from "starknet";
import { nativeQuestConstants as quest } from "../../../../contracts/l3/world-native/schema/balance.gen";

/** The contract's seven-quest bag, including its boundary swap. Day indices start at zero. */
export function dailyQuest(seed: bigint, day: number): number {
  if (!Number.isSafeInteger(day) || day < 0) throw new Error("Invalid quest day");
  const week = Math.floor(day / quest.QUEST_COUNT);
  const bag = shuffledBag(seed, week);
  const index = day % quest.QUEST_COUNT;
  if (week > 0 && index < 2 && shuffledBag(seed, week - 1).at(-1) === bag[0]) return bag[1 - index];
  return bag[index];
}

function shuffledBag(seed: bigint, week: number): number[] {
  const bag = Array.from({ length: quest.QUEST_COUNT }, (_, index) => index);
  const root = BigInt(hash.computePoseidonHashOnElements([seed, week, shortString.encodeShortString("daily-quest")]));
  const low = root & ((1n << 128n) - 1n);
  const high = root >> 128n;
  for (let remaining = quest.QUEST_COUNT; remaining > 1; remaining--) {
    const chosen = Number(BigInt(hash.computePoseidonHashOnElements([low, high, remaining])) % BigInt(remaining));
    [bag[chosen], bag[remaining - 1]] = [bag[remaining - 1], bag[chosen]];
  }
  return bag;
}

/** The seven quests of the bag a day falls in, by day index: the week the Today page shows. */
export function questWeek(seed: bigint, day: number): { day: number; quest: number }[] {
  const first = Math.floor(day / quest.QUEST_COUNT) * quest.QUEST_COUNT;
  return Array.from({ length: quest.QUEST_COUNT }, (_, index) => ({
    day: first + index,
    quest: dailyQuest(seed, first + index),
  }));
}
