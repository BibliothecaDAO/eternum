import { WorkerEntrypoint } from "cloudflare:workers";
import { Effect } from "effect";
import type { IdentityEnv } from "./env";
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
}
