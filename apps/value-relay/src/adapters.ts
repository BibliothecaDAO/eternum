import { relayOperation, type RelayPorts, type Withdrawal } from "./ports";

interface IdentityPort {
  payoutWallet(realmsId: string): Promise<import("@realms-world/identity").PayoutWallet>;
  accountForRealmsId(realmsId: string): Promise<string | null>;
  linkedWallet(realmsId: string): Promise<string | null>;
}
export const identityAdapter = (identity: IdentityPort): RelayPorts["identity"] => ({
  payoutWallet: (id) => relayOperation("read payout wallet", () => identity.payoutWallet(id)),
  accountForRealmsId: (id) => relayOperation("derive Realms gameplay account", () => identity.accountForRealmsId(id)),
  linkedWallet: (id) => relayOperation("read linked wallet", () => identity.linkedWallet(id)),
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
