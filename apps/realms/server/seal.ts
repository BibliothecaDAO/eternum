import { canonicalRealm } from "@bibliothecadao/eternum";
import { SEAL_CENTS, SEAL_FREE } from "@bibliothecadao/types";
import { type TicketTier } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import { json } from "./http";
import { RealmHoldingsUnavailableError } from "./realm-holdings";
import { quoteLords, type LordsQuoteReader } from "./lords-price";
import { holdsSeal } from "./seal-codes";
import { authorizeShop, namedGame, type ShopAccess } from "./shop-game";

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

/** What the seal's route reads beyond D1: the account's holder facts, the shop's rule and the market. */
export interface SealWorld {
  db: D1Database;
  access: ShopAccess;
  holderFacts: (realmsId: string) => Promise<HolderFacts>;
  readLordsQuote: LordsQuoteReader;
}

/**
 * GET /api/shop/seal?chain=&game=: for an account that plays in that running Frontier game (the shop's one rule), its
 * holder level, whether it holds the seal, and the seal's price in cents on the web and in a store with what is free to
 * this holder. An account that holds the seal is offered no purchase. The web price carries its LORDS amount, quoted by
 * AVNU as the request is answered (null while it cannot quote).
 */
export async function handleSeal(request: Request, auth: IdentityAuth, world: SealWorld): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const url = new URL(request.url);
  const seat = await authorizeShop(
    request,
    auth,
    world.access,
    namedGame(url.searchParams.get("chain"), url.searchParams.get("game")),
  );
  if (seat instanceof Response) return seat;
  const { owner } = seat;
  if (await holdsSeal(world.db, owner)) return json({ owned: true, web: null, store: null });
  const facts = await readHolderFacts(world, owner);
  if (!facts) return json({ error: "holdings_unavailable" }, 503);
  const holder = holderLevelOf(facts);
  return json({
    holder,
    owned: false,
    web: { ...sealOffer(holder, "web"), lords: await sealLords(world, holder) },
    store: sealOffer(holder, "store"),
  });
}

/** The web price in whole LORDS at AVNU's quote now; null while it cannot quote, never a made-up amount. */
const sealLords = ({ readLordsQuote }: SealWorld, holder: Holder) =>
  quoteLords(sealOffer(holder, "web").cents, readLordsQuote);

/** The account's holder facts, or null while the chain cannot say: no offer is made on a guess. */
const readHolderFacts = async (world: SealWorld, owner: string) => {
  try {
    return await world.holderFacts(owner);
  } catch (error) {
    if (error instanceof RealmHoldingsUnavailableError) return null;
    throw error;
  }
};
