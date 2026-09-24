import { RpcError, type RpcProvider } from "starknet";

const CONFIRMATION_TIMEOUT_MS = 300_000;
const STATUS_POLL_MS = 1_000;

/**
 * A transaction's receipt once the chain has accepted it, read over HTTP: a shard's public RPC serves no node
 * WebSockets. Its status is polled until accepted or rejected, then its receipt must show a block and success.
 */
export async function confirmedTransactionReceipt(
  provider: RpcProvider,
  transactionHash: string,
): Promise<Awaited<ReturnType<RpcProvider["getTransactionReceipt"]>> & { block_number: number }> {
  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;
  while (!(await isAccepted(provider, transactionHash))) {
    if (Date.now() >= deadline) throw new Error(`Transaction ${transactionHash} confirmation timed out`);
    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
  }
  const receipt = await provider.getTransactionReceipt(transactionHash);
  if (!("block_number" in receipt) || !Number.isSafeInteger(receipt.block_number))
    throw new Error(`Transaction ${transactionHash} has no confirmed block`);
  if (receipt.execution_status !== "SUCCEEDED")
    throw new Error(`Transaction ${transactionHash} transaction reverted: ${receipt.revert_reason}`);
  return receipt;
}

/** True once accepted; a rejection throws; a transaction the node does not know yet is still pending. */
async function isAccepted(provider: RpcProvider, transactionHash: string): Promise<boolean> {
  const status = await provider.getTransactionStatus(transactionHash).catch((error: unknown) => {
    if (error instanceof RpcError && error.isType("TXN_HASH_NOT_FOUND")) return null;
    throw error;
  });
  if (status?.finality_status === "REJECTED")
    throw new Error(`Transaction ${transactionHash} rejected: ${status.failure_reason ?? "REJECTED"}`);
  return status?.finality_status === "ACCEPTED_ON_L2" || status?.finality_status === "ACCEPTED_ON_L1";
}
