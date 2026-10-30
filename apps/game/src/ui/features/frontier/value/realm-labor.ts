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
