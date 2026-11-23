import { directoryShard } from "./directory";
import { recordPayDecision, matchesPayDecision } from "./pay-decisions";
import { createIdentityAuth } from "./auth";
import { WorkerEntrypoint } from "cloudflare:workers";
import { normalizeStarknetAddress, type LedgerPayDecision } from "@realms-world/identity";
import { realmsAccountAddress } from "@realms-world/identity/account";
import { ACCOUNT_CLASS_HASH, decodeIdentityEnv, type IdentityEnv } from "./env";
import { encodeChainName, environmentL2 } from "@realms-world/chain";
import { identityL2Configuration } from "./l2";
import { heldRealms, holdsRealm } from "./realm-holdings";
import { realmsIdsOfAccounts } from "./realms-accounts";
import { readLinkedWallet } from "./linked-wallet";
import { holdsSeal } from "./seal-codes";

/** Only a service binding exposes these reads; they have no public HTTP route. */
export class ValueIdentity extends WorkerEntrypoint<IdentityEnv> {
  shard() {
    return directoryShard(this.env.DB);
  }
  l2ChainId() {
    return encodeChainName(identityL2Configuration(this.env).chainId);
  }
  override fetch() {
    return new Response(null, { status: 404 });
  }
  /** The relay posted results: the ratings changed, so the rating reader drops what it kept. */
  ratingsChanged() {
    return this.env.RATING_READER.get(
      this.env.RATING_READER.idFromName(environmentL2(this.env.ENVIRONMENT).chain),
    ).ratingsChanged();
  }
  holdsRealm(wallet: string, realmId: number) {
    return holdsRealm(decodeIdentityEnv(this.env as unknown as Record<string, unknown>), wallet, realmId);
  }
  /**
   * The Realms `wallet` holds, by number: the answer value relays before the held-Realms maps (10-29) read. It stays
   * until every running relay asks heldRealmsWithMaps instead.
   */
  async heldRealms(wallet: string) {
    return (await this.heldRealmsWithMaps(wallet)).map((held) => held.realmId);
  }
  /** The Realms `wallet` holds, each with the Realm index's map of it. */
  heldRealmsWithMaps(wallet: string) {
    return heldRealms(decodeIdentityEnv(this.env as unknown as Record<string, unknown>), wallet);
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
    return user ? realmsAccountAddress(user.realmsId, ACCOUNT_CLASS_HASH, await this.env.GUARDIAN.publicKey()) : null;
  }
  holdsSeal(realmsId: string) {
    return holdsSeal(this.env.DB, realmsId);
  }
  async authenticate(cookie: string): Promise<{ realmsId: string } | null> {
    const session = await createIdentityAuth(this.env).api.getSession({ headers: new Headers({ cookie }) });
    if (!session || session.user.emailVerified !== true || !session.user.realmsId) return null;
    return { realmsId: session.user.realmsId };
  }
}
