import { aspectLordsWorth, aspectRewardShare, aspects, sharesAspectReward } from "@bibliothecadao/types";

export interface RaceFacts {
  winner: number | null;
  heights: readonly { aspect: number; height: number }[];
  members: readonly { home: bigint; aspect: number; glory: bigint }[];
}

export interface RaceReward {
  home: bigint;
  aspect: number;
  amount: bigint;
}

const LORDS = 10n ** 18n;

export function raceRewards(facts: RaceFacts): { total: bigint; rewards: RaceReward[] } {
  const heights = aspectHeights(facts);
  const rewards = aspects.flatMap(({ id }) =>
    shareAspectAmount(id, aspectAmount(heights.get(id)!, facts.winner === id), eligibleMembers(facts, id)),
  );
  rewards.sort((a, b) => (a.home < b.home ? -1 : 1));
  return { total: rewards.reduce((sum, reward) => sum + reward.amount, 0n), rewards };
}

function aspectAmount(height: number, finishedFirst: boolean) {
  return BigInt(aspectLordsWorth(height, finishedFirst)) * LORDS;
}

function shareAspectAmount(aspect: number, amount: bigint, members: RaceFacts["members"]): RaceReward[] {
  const glory = members.reduce((sum, member) => sum + member.glory, 0n);
  return members
    .map((member) => ({ home: member.home, aspect, amount: aspectRewardShare(amount, member.glory, glory) }))
    .filter((reward) => reward.amount > 0n);
}

function eligibleMembers(facts: RaceFacts, aspect: number) {
  return facts.members.filter((member) => member.aspect === aspect && sharesAspectReward(member.glory));
}

function aspectHeights(facts: RaceFacts) {
  const heights = new Map(facts.heights.map((row) => [row.aspect, row.height]));
  if (facts.heights.length !== aspects.length || aspects.some(({ id }) => !heights.has(id)))
    throw new Error("race_heights_incomplete");
  for (const height of heights.values())
    if (!Number.isSafeInteger(height) || height < 0) throw new Error("race_height_invalid");
  if (facts.winner !== null && !heights.has(facts.winner)) throw new Error("race_winner_invalid");
  assertMembers(facts.members);
  return heights;
}

function assertMembers(members: RaceFacts["members"]) {
  if (new Set(members.map((member) => member.home)).size !== members.length) throw new Error("race_member_duplicated");
  for (const member of members)
    if (member.home <= 0n || member.glory < 0n || !aspects.some(({ id }) => id === member.aspect))
      throw new Error("race_member_invalid");
}
