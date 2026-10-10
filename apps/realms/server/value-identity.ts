import { recordPayDecision, matchesPayDecision } from "./pay-decisions";
import { createIdentityAuth } from "./auth";
import { WorkerEntrypoint } from "cloudflare:workers";
import { normalizeStarknetAddress, type LedgerPayDecision } from "@realms-world/identity";
import { realmsAccountAddress } from "@realms-world/identity/account";
import { Effect } from "effect";
import { decodeIdentityEnv, type IdentityEnv } from "./env";
import { encodeChainName } from "@realms-world/chain";
import { identityL2Configuration, realmOwnerOf } from "./l2";
import { realmsIdsOfAccounts } from "./realms-accounts";
import { lookupPayoutWallet, readLinkedWallet } from "./payout-wallet";

/** Only a service binding exposes these reads; they have no public HTTP route. */
export class ValueIdentity extends WorkerEntrypoint<IdentityEnv> {
  l2ChainId() {
    return encodeChainName(identityL2Configuration(this.env).chainId);
  }
  override fetch() {
    return new Response(null, { status: 404 });
  }
  realmOwnerOf(realmId: string) {
    return realmOwnerOf(decodeIdentityEnv(this.env as unknown as Record<string, unknown>), realmId);
  }
  payoutWallet(realmsId: string) {
    return Effect.runPromise(lookupPayoutWallet(this.env.DB, realmsId));
  }
  async recordPayDecisions(decisions: LedgerPayDecision[]) {
    for (const decision of decisions) await recordPayDecision(this.env.DB, decision);
  }
  matchesPayDecision(decision: LedgerPayDecision) {
    return matchesPayDecision(this.env.DB, decision);
  }

  async linkedWallet(realmsId: string) {
    return (await readLinkedWallet(this.env.DB, realmsId))?.address ?? null;
  }
  async realmsIdForAccount(account: string): Promise<string | null> {
    return (await realmsIdsOfAccounts(this.env.DB, [account])).get(normalizeStarknetAddress(account)) ?? null;
  }
  async accountForRealmsId(realmsId: string): Promise<string | null> {
    const user = await this.env.DB.prepare('SELECT "realmsId" FROM "user" WHERE "realmsId" = ? AND "emailVerified" = 1')
      .bind(realmsId)
      .first<{ realmsId: string }>();
    return user
      ? realmsAccountAddress(user.realmsId, this.env.ACCOUNT_CLASS_HASH, await this.env.GUARDIAN.publicKey())
      : null;
  }
  async authenticate(cookie: string): Promise<{ realmsId: string } | null> {
    const session = await createIdentityAuth(this.env).api.getSession({ headers: new Headers({ cookie }) });
    if (!session || session.user.emailVerified !== true || !session.user.realmsId) return null;
    return { realmsId: session.user.realmsId };
  }
}
