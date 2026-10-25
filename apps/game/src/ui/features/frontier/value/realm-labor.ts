export interface RealmLaborPlan {
  eligible: boolean;
  claimed: boolean;
  total: number;
  fits: number;
}

export const planRealmLabor = ({
  eligible,
  claimed,
  amount,
  held,
  limit,
}: {
  eligible: boolean;
  claimed: boolean;
  amount: number;
  held: number;
  limit: number | undefined;
}): RealmLaborPlan => {
  const total = eligible && !claimed ? amount : 0;
  return {
    eligible,
    claimed,
    total,
    fits: Math.min(total, limit === undefined ? total : Math.max(0, Math.floor(limit - held))),
  };
};
