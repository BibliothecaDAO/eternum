import { canonicalRealm } from "@bibliothecadao/eternum";
import { SEAL_CENTS, SEAL_FREE } from "@bibliothecadao/types";
import { type TicketTier } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import { json } from "./http";

/** What an account holds that the seal's price and free parts read: its Realms, and the tier of the campaign ticket it came by. */
export interface HolderFacts {
  heldRealmIds: readonly number[];
  ticket: TicketTier | null;
}

/**
 * Who the buyer is for the Ancient Seal (the frozen design's holder table): a held Wonder, or a golden ticket home, is
 * the highest; a held Realm, or a regular ticket home, the next; anyone else holds nothing.
 */
export const holderLevelOf = ({ heldRealmIds, ticket }: HolderFacts) =>
  ticket === "golden" || heldRealmIds.some((realmId) => canonicalRealm(realmId).wonder !== null)
    ? ("wonder" as const)
    : ticket === "regular" || heldRealmIds.length > 0
      ? ("realm" as const)
      : ("none" as const);

type Channel = keyof typeof SEAL_CENTS;
type Holder = ReturnType<typeof holderLevelOf>;

/** What the seal costs this holder where it is bought, in cents, and what it already has free. */
export const sealOffer = (holder: Holder, channel: Channel) => ({
  cents: SEAL_CENTS[channel][holder],
  free: SEAL_FREE[holder],
});

/** The account's seal, or null while it has none. */
export const readSeal = (db: D1Database, owner: string) =>
  db
    .prepare('SELECT "paid_cents", "source", "granted_at" FROM "seal" WHERE "owner" = ?')
    .bind(owner)
    .first<{ paid_cents: number; source: "web" | "store"; granted_at: number }>();

/**
 * Writes a seal down once. An account that has one keeps it ("held"); a receipt already written for another account
 * is refused ("receipt_used"), so one payment buys one seal.
 */
export const grantSeal = async (
  db: D1Database,
  seal: { owner: string; paidCents: number; source: "web" | "store"; receipt: string; now: number },
): Promise<"granted" | "held" | "receipt_used"> => {
  const used = await db
    .prepare('SELECT "owner" FROM "seal" WHERE "receipt" = ?')
    .bind(seal.receipt)
    .first<{ owner: string }>();
  if (used) return used.owner === seal.owner ? "held" : "receipt_used";
  if (await readSeal(db, seal.owner)) return "held";
  try {
    await db
      .prepare('INSERT INTO "seal" ("owner", "paid_cents", "source", "receipt", "granted_at") VALUES (?, ?, ?, ?, ?)')
      .bind(seal.owner, seal.paidCents, seal.source, seal.receipt, seal.now)
      .run();
    return "granted";
  } catch (error) {
    if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) return "receipt_used";
    throw error;
  }
};

/** What the seal's route reads beyond D1: the account's holder facts. */
export interface SealWorld {
  db: D1Database;
  holderFacts: (realmsId: string) => Promise<HolderFacts>;
}

/**
 * GET /api/shop/seal: the signed-in account's holder level, whether it holds the seal, and the seal's price in cents on
 * the web and in a store with what is free to this holder. The LORDS amount is the client's (the day's price).
 */
export async function handleSeal(request: Request, auth: IdentityAuth, world: SealWorld): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const session = await auth.api.getSession({ headers: request.headers });
  const owner = session?.user.realmsId;
  if (!owner) return json({ error: "unauthorized" }, 401);
  const [held, facts] = await Promise.all([readSeal(world.db, owner), world.holderFacts(owner)]);
  const holder = holderLevelOf(facts);
  return json({
    holder,
    owned: held !== null,
    web: sealOffer(holder, "web"),
    store: sealOffer(holder, "store"),
  });
}
