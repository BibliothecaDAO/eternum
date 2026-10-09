import { Effect } from "effect";
import { RelayFailure, relayOperation, type RelayPorts, type MonitorPorts, type Withdrawal } from "./ports";

interface IdentityPort {
  payoutWallet(realmsId: string): Promise<import("@realms-world/identity").PayoutWallet>;
  linkedWallet(realmsId: string): Promise<string | null>;
}
const identityAdapter = (identity: IdentityPort): RelayPorts["identity"] => ({
  payoutWallet: (id) => relayOperation("read payout wallet", () => identity.payoutWallet(id)),
  linkedWallet: (id) => relayOperation("read linked wallet", () => identity.linkedWallet(id)),
});

/** Contract adapters remain closed until the shard receipt schema and the complete ledger ABI arrive. */
const unavailable = (operation: string) =>
  Effect.fail(new RelayFailure({ operation: `interface_unavailable:${operation}` }));
export const pendingRelayPorts = (
  identity: IdentityPort,
  ledger: RelayPorts["ledger"],
  realms: RelayPorts["realms"],
): RelayPorts => ({
  identity: identityAdapter(identity),
  shard: {
    confirmedHead: () => unavailable("shard.confirmedHead"),
    block: () => unavailable("shard.block"),
    withdrawal: () => unavailable("shard.withdrawal"),
    result: () => unavailable("shard.result"),
    grantLabor: () => unavailable("shard.grantLabor"),
  },
  ledger,
  realms,
});
export const pendingMonitorPorts = (ledger: MonitorPorts["ledger"]): MonitorPorts => ({
  shard: { withdrawal: () => unavailable("shard.withdrawal"), result: () => unavailable("shard.result") },
  ledger,
});

/** Published Frontier call; confirmation is part of the injected transport, never fire-and-forget. */
export const frontierPayment =
  (submit: (entrypoint: string, calldata: readonly string[]) => Promise<void>) =>
  (withdrawal: Withdrawal, wallet: string) =>
    relayOperation("pay Frontier claim", () => {
      const amount = BigInt(withdrawal.amount);
      if (amount <= 0n || amount >= 2n ** 256n) throw new Error("Invalid withdrawal amount");
      return submit("pay", [
        withdrawal.chainId,
        String(withdrawal.seasonId),
        withdrawal.transactionHash,
        wallet,
        String(amount & (2n ** 128n - 1n)),
        String(amount >> 128n),
      ]);
    });
