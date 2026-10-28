export interface RealmLaborPlan {
  eligible: boolean;
  claimed: boolean;
  total: number;
  fits: number;
  /** A golden ticket's Essence, claimed with the Labor; it lands even when no Labor fits. */
  essence: number;
  /** Today's claim gives something: Labor that fits, or Essence. */
  claimable: boolean;
}

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
