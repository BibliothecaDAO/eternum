import { canonicalRealm } from "@bibliothecadao/eternum";

import type { IdentityEnv } from "./env";
import { readLinkedWallet } from "./linked-wallet";
import { heldRealms, holdsRealm } from "./realm-holdings";
import type { HolderFacts } from "./seal";

/** The two readers of Realm holdings: the marketplace's list of a wallet's Realms, and the chain's live owner of one. */
export interface HoldingsReaders {
  listed: typeof heldRealms;
  holds: typeof holdsRealm;
}

export const holderFactsOf =
  (env: IdentityEnv, readers: HoldingsReaders = { listed: heldRealms, holds: holdsRealm }) =>
  async (realmsId: string): Promise<HolderFacts> => {
    const wallet = (await readLinkedWallet(env.DB, realmsId))?.address;
    return { heldRealmIds: wallet ? await liveHolding(env, readers, wallet) : [] };
  };

/** The first listed Realm the wallet holds live, Wonder Realms checked first: one is all a holder level needs. */
const liveHolding = async (env: IdentityEnv, readers: HoldingsReaders, wallet: string): Promise<number[]> => {
  const candidates = (await readers.listed(env, wallet)).map(({ realmId }) => realmId);
  const wonders = candidates.filter((realmId) => canonicalRealm(realmId).wonder !== null);
  for (const realmId of [...wonders, ...candidates.filter((realmId) => !wonders.includes(realmId))])
    if (await readers.holds(env, wallet, realmId)) return [realmId];
  return [];
};
