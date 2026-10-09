import { WorkerEntrypoint } from "cloudflare:workers";
import { normalizeStarknetAddress } from "@realms-world/identity";
import { realmsAccountAddress } from "@realms-world/identity/account";
import { Effect } from "effect";
import type { IdentityEnv } from "./env";
import { realmsIdsOfAccounts } from "./realms-accounts";
import { lookupPayoutWallet, readLinkedWallet } from "./payout-wallet";

/** Only a service binding exposes these reads; they have no public HTTP route. */
export class ValueIdentity extends WorkerEntrypoint<IdentityEnv> {
  override fetch() {
    return new Response(null, { status: 404 });
  }
  payoutWallet(realmsId: string) {
    return Effect.runPromise(lookupPayoutWallet(this.env.DB, realmsId));
  }
  async linkedWallet(realmsId: string) {
    return (await readLinkedWallet(this.env.DB, realmsId))?.address ?? null;
  }
  async accountForWallet(wallet: string): Promise<string | null> {
    const user = await this.env.DB.prepare('SELECT "realmsId" FROM "user" WHERE "address" = ? AND "emailVerified" = 1')
      .bind(normalizeStarknetAddress(wallet))
      .first<{ realmsId: string }>();
    if (!user) return null;
    return realmsAccountAddress(user.realmsId, this.env.ACCOUNT_CLASS_HASH, await this.env.GUARDIAN.publicKey());
  }
  async realmsIdForAccount(account: string): Promise<string | null> {
    return (await realmsIdsOfAccounts(this.env.DB, [account])).get(normalizeStarknetAddress(account)) ?? null;
  }
}
