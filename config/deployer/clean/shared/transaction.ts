import { WebSocketChannel, type RpcProvider } from "starknet";

export async function confirmedTransactionReceipt(
  provider: RpcProvider,
  transactionHash: string,
): Promise<Awaited<ReturnType<RpcProvider["getTransactionReceipt"]>> & { block_number: number }> {
  const channel = new WebSocketChannel({
    nodeUrl: provider.channel.nodeUrl.replace(/^http/, "ws"),
    autoReconnect: true,
  });
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Transaction ${transactionHash} confirmation timed out`)), 300_000);
  });
  try {
    return await Promise.race([readConfirmedReceipt(provider, channel, transactionHash), deadline]);
  } finally {
    clearTimeout(timer!);
    channel.disconnect();
  }
}

async function readConfirmedReceipt(provider: RpcProvider, channel: WebSocketChannel, transactionHash: string) {
  await channel.waitForConnection();
  const subscription = await channel.subscribeTransactionStatus({ transactionHash });
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    let observedSocket: unknown;
    const observe = (status: { finality_status: string; failure_reason?: string }) => {
      if (finished) return;
      if (status.finality_status === "REJECTED") {
        finished = true;
        reject(new Error(`Transaction ${transactionHash} rejected: ${status.failure_reason ?? "REJECTED"}`));
      } else if (["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(status.finality_status)) {
        finished = true;
        resolve();
      }
    };
    const catchUp = () => {
      if (finished || observedSocket === channel.websocket) return;
      observedSocket = channel.websocket;
      void provider.getTransactionStatus(transactionHash).then(observe, reject);
    };
    channel.on("open", catchUp);
    subscription.on(({ status }) => observe(status));
    catchUp();
  });
  const receipt = await provider.getTransactionReceipt(transactionHash);
  if (!("block_number" in receipt) || !Number.isSafeInteger(receipt.block_number))
    throw new Error(`Transaction ${transactionHash} has no confirmed block`);
  if (receipt.execution_status !== "SUCCEEDED")
    throw new Error(`Transaction ${transactionHash} transaction reverted: ${receipt.revert_reason}`);
  return receipt;
}
