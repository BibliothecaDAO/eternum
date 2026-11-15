import { canonicalRealm } from "@bibliothecadao/eternum";
import type { TicketTier } from "@realms-world/identity";

import type { IdentityEnv } from "./env";
import { readLinkedWallet } from "./linked-wallet";
import { heldRealms, holdsRealm } from "./realm-holdings";
import type { HolderFacts } from "./seal";

/** The two readers of Realm holdings: the marketplace's list of a wallet's Realms, and the chain's live owner of one. */
export interface HoldingsReaders {
  listed: typeof heldRealms;
  holds: typeof holdsRealm;
}

/**
 * What the Ancient Seal's price reads of an account: its campaign ticket (a golden ticket outranks a regular one) and
 * the Realms its linked wallet holds now. The marketplace only names the candidates, Wonder Realms first; a Realm
 * counts only when the chain's live owner is the wallet, so a sold Realm the index still lists gives no discount. When
 * the chain cannot answer, the read fails and nothing is discounted.
 */
export const holderFactsOf =
  (env: IdentityEnv, readers: HoldingsReaders = { listed: heldRealms, holds: holdsRealm }) =>
  async (realmsId: string): Promise<HolderFacts> => {
    const wallet = (await readLinkedWallet(env.DB, realmsId))?.address;
    const heldRealmIds = wallet ? await liveHolding(env, readers, wallet) : [];
    const tiers = await env.DB.prepare('SELECT DISTINCT "tier" FROM "campaign_tickets" WHERE "owner" = ?')
      .bind(realmsId)
      .all<{ tier: TicketTier }>();
    const ticket = tiers.results.some(({ tier }) => tier === "golden")
      ? "golden"
      : tiers.results.length > 0
        ? "regular"
        : null;
    return { heldRealmIds, ticket };
  };

/** The first listed Realm the wallet holds live, Wonder Realms checked first: one is all a holder level needs. */
const liveHolding = async (env: IdentityEnv, readers: HoldingsReaders, wallet: string): Promise<number[]> => {
  const candidates = (await readers.listed(env, wallet)).map(({ realmId }) => realmId);
  const wonders = candidates.filter((realmId) => canonicalRealm(realmId).wonder !== null);
  for (const realmId of [...wonders, ...candidates.filter((realmId) => !wonders.includes(realmId))])
    if (await readers.holds(env, wallet, realmId)) return [realmId];
  return [];
};
