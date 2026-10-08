import type { RpcProvider } from "starknet";
import { confirmedTransactionReceipt } from "../../../../config/deployer/clean/shared/transaction";

/** Untimed setup requires confirmed success; a missing status during publication is still pending. */
export function configureAccountConfirmation(provider: RpcProvider): void {
  provider.waitForTransaction = (transactionHash) => confirmedTransactionReceipt(provider, transactionHash);
}
