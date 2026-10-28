export interface RealmLaborPlan {
  eligible: boolean;
  claimed: boolean;
  total: number;
  fits: number;
  /** A golden ticket's Essence, claimed with the Labor. */
  essence: number;
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
  const total = eligible && !claimed ? amount : 0;
  return {
    eligible,
    claimed,
    total,
    fits: Math.min(total, limit === undefined ? total : Math.max(0, Math.floor(limit - held))),
    essence: eligible && !claimed ? essence : 0,
  };
};
