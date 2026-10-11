/** A Realm the account has claimed labor with, and whether it gave its labor this UTC day. */
export type HeldRealm = { realmId: number; name: string; order: number; claimedToday: boolean };

export type RealmLaborState = "claimed" | "ready" | "locked";

export type RealmLaborPlan = {
  /** Each held Realm in the order given: claimed today, ready now, or past the day's cap. */
  rows: readonly { realm: HeldRealm; state: RealmLaborState }[];
  /** The labor the ready Realms give together. */
  total: number;
  /** What of it the realm's labor store takes now: a claim pays what fits. */
  fits: number;
  /** Whether another Realm can still give its labor today: the day's cap of Realms is not spent. */
  canAdd: boolean;
};

/**
 * What claiming now gives (value screens, b): each Realm gives `perRealm` labor once a game day, at most `cap` Realms an
 * account a day (zero means no cap), and the claim pays what fits under the labor limit. Both numbers are presets.
 */
export const planRealmLabor = ({
  realms,
  perRealm,
  cap,
  labor,
}: {
  realms: readonly HeldRealm[];
  perRealm: number;
  cap: number;
  labor: { held: number; limit: number | undefined };
}): RealmLaborPlan => {
  const claimed = realms.filter((realm) => realm.claimedToday).length;
  let left = (cap > 0 ? cap : realms.length) - claimed;
  const rows = realms.map((realm) => {
    if (realm.claimedToday) return { realm, state: "claimed" as const };
    if (left <= 0) return { realm, state: "locked" as const };
    left -= 1;
    return { realm, state: "ready" as const };
  });
  const total = rows.filter((row) => row.state === "ready").length * perRealm;
  const room = labor.limit === undefined ? total : Math.max(0, Math.floor(labor.limit - labor.held));
  return { rows, total, fits: Math.min(total, room), canAdd: cap === 0 || claimed < cap };
};
