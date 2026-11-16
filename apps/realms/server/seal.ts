import { canonicalRealm } from "@bibliothecadao/eternum";
import { lordsFor, SEAL_CENTS, SEAL_FREE } from "@bibliothecadao/types";
import { type TicketTier } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import { json } from "./http";
import { RealmHoldingsUnavailableError } from "./realm-holdings";

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

/** The market price of one LORDS in dollars fixed at the season's launch, or null before a season's launch has set it. */
export const readSealLaunchPrice = async (db: D1Database): Promise<number | null> =>
  (await db.prepare('SELECT "usd" FROM "seal_launch_price" WHERE "id" = 1').first<{ usd: number }>())?.usd ?? null;

/**
 * POST /api/operator/seal-price {usd}: the season's launch sets the seal's LORDS price once (dollars a LORDS). Setting the
 * same value again is a no-op; a different one is refused, the price holds for the season.
 */
export async function handleSealLaunchPrice(request: Request, db: D1Database, now: number): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const usd = ((await request.json().catch(() => null)) as { usd?: unknown } | null)?.usd;
  if (typeof usd !== "number" || !(usd > 0) || !Number.isFinite(usd)) return json({ error: "invalid_price" }, 400);
  await db
    .prepare('INSERT INTO "seal_launch_price" ("id", "usd", "set_at") VALUES (1, ?, ?) ON CONFLICT DO NOTHING')
    .bind(usd, now)
    .run();
  return (await readSealLaunchPrice(db)) === usd ? json({ usd }) : json({ error: "seal_price_already_set" }, 409);
}

/** What the seal's route reads beyond D1: the account's holder facts. */
export interface SealWorld {
  db: D1Database;
  holderFacts: (realmsId: string) => Promise<HolderFacts>;
}

/**
 * GET /api/shop/seal: the signed-in account's holder level, whether it holds the seal, and the seal's price in cents on
 * the web and in a store with what is free to this holder. An account that holds the seal is offered no purchase. The web price carries its LORDS amount, fixed at the season's launch (null before it is set).
 */
export async function handleSeal(request: Request, auth: IdentityAuth, world: SealWorld): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const session = await auth.api.getSession({ headers: request.headers });
  const owner = session?.user.realmsId;
  if (!owner) return json({ error: "unauthorized" }, 401);
  if (await readSeal(world.db, owner)) return json({ owned: true, web: null, store: null });
  const facts = await readHolderFacts(world, owner);
  if (!facts) return json({ error: "holdings_unavailable" }, 503);
  const holder = holderLevelOf(facts);
  return json({
    holder,
    owned: false,
    web: { ...sealOffer(holder, "web"), lords: await sealLords(world.db, holder) },
    store: sealOffer(holder, "store"),
  });
}

/** The web price in whole LORDS at the launch price; null before launch has set it, never a made-up amount. */
const sealLords = async (db: D1Database, holder: Holder) => {
  const usd = await readSealLaunchPrice(db);
  return usd === null ? null : lordsFor(sealOffer(holder, "web").cents, usd);
};

/** The account's holder facts, or null while the chain cannot say: no offer is made on a guess. */
const readHolderFacts = async (world: SealWorld, owner: string) => {
  try {
    return await world.holderFacts(owner);
  } catch (error) {
    if (error instanceof RealmHoldingsUnavailableError) return null;
    throw error;
  }
};
