import type { SEASON_DAY_STATES } from "@/ui/design-system/kit/words";
import type { CampaignMark } from "./campaign-home";

export interface RealmLaborPlan {
  eligible: boolean;
  claimed: boolean;
  total: number;
  fits: number;
  /** A campaign home's Essence, claimed with the Labor; it lands even when no Labor fits. */
  essence: number;
  /** Today's claim gives something: Labor that fits, or Essence. */
  claimable: boolean;
}

/** What today's claim has waiting for the home: its Labor, and a campaign home's Essence. */
export interface DailyClaimWaiting {
  labor: number;
  essence: number;
}

/**
 * The one reading of the plan the Realms chip and the Menu's Realms dot show: today's Labor and Essence while either is
 * due, null when nothing is. Essence counts on its own, so a day whose Labor no longer fits still shows its Essence.
 */
export const dailyClaimWaiting = (plan: RealmLaborPlan | undefined): DailyClaimWaiting | null =>
  plan && (plan.total > 0 || plan.essence > 0) ? { labor: plan.total, essence: plan.essence } : null;

export const planRealmLabor = ({
  eligible,
  claimed,
  amount,
  essence,
  held,
  limit,
}: {
  eligible: boolean;
  claimed: boolean;
  amount: number;
  essence: number;
  held: number;
  limit: number | undefined;
}): RealmLaborPlan => {
  const due = eligible && !claimed;
  const total = due ? amount : 0;
  const fits = Math.min(total, limit === undefined ? total : Math.max(0, Math.floor(limit - held)));
  const essenceDue = due ? essence : 0;
  return { eligible, claimed, total, fits, essence: essenceDue, claimable: fits > 0 || essenceDue > 0 };
};

/** The home whose claim the sheet shows: a campaign's (its mark), or a held Realm's (its number and name). */
export type LaborHome = { kind: "campaign"; mark: CampaignMark } | { kind: "realm"; realmId: number; name: string };

/** One day on the sheet's strip: its number (Day 1 first), what became of its claim, and whether it is today. */
export interface SeasonDay {
  day: number;
  state: keyof typeof SEASON_DAY_STATES;
  today: boolean;
}

/** How many days the strip shows: the five before today, today and the next, moved inside the season at its edges. */
const SEASON_STRIP_DAYS = 7;

/**
 * The strip's days around today, by index (0 is Day 1): each claimed or missed before today, ahead after it, and none
 * missed before the home was founded. `last` is the season's last day, undefined for a season with no end.
 */
export const seasonStrip = ({
  today,
  last,
  founded,
  claimed,
  claimedToday,
}: {
  today: number;
  last: number | undefined;
  founded: number;
  claimed: (index: number) => boolean;
  claimedToday: boolean;
}): SeasonDay[] => {
  const latestStart = last === undefined ? Infinity : Math.max(0, last - SEASON_STRIP_DAYS + 1);
  const start = Math.max(0, Math.min(today - (SEASON_STRIP_DAYS - 2), latestStart));
  const end = last === undefined ? start + SEASON_STRIP_DAYS - 1 : Math.min(last, start + SEASON_STRIP_DAYS - 1);
  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const index = start + offset;
    return {
      day: index + 1,
      state: dayState(index, { today, founded, claimed, claimedToday }),
      today: index === today,
    };
  });
};

const dayState = (
  index: number,
  {
    today,
    founded,
    claimed,
    claimedToday,
  }: { today: number; founded: number; claimed: (index: number) => boolean; claimedToday: boolean },
): SeasonDay["state"] => {
  if (index === today) return claimedToday ? "claimed" : "open";
  if (index > today) return "ahead";
  if (index < founded) return "before";
  return claimed(index) ? "claimed" : "missed";
};
