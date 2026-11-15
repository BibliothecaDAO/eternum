import type { TicketTier } from "@realms-world/identity";

import type { IdentityEnv } from "./env";
import { readLinkedWallet } from "./linked-wallet";
import { heldRealms } from "./realm-holdings";
import type { HolderFacts } from "./seal";

/**
 * What the Ancient Seal's price reads of an account, from the chain's holdings of its linked wallet and its campaign
 * ticket: a golden ticket outranks a regular one; an account with no linked wallet holds no Realm.
 */
export const holderFactsOf =
  (env: IdentityEnv) =>
  async (realmsId: string): Promise<HolderFacts> => {
    const wallet = (await readLinkedWallet(env.DB, realmsId))?.address;
    const held = wallet ? await heldRealms(env, wallet) : [];
    const tiers = await env.DB.prepare('SELECT DISTINCT "tier" FROM "campaign_tickets" WHERE "owner" = ?')
      .bind(realmsId)
      .all<{ tier: TicketTier }>();
    const ticket = tiers.results.some(({ tier }) => tier === "golden")
      ? "golden"
      : tiers.results.length > 0
        ? "regular"
        : null;
    return { heldRealmIds: held.map(({ realmId }) => realmId), ticket };
  };
