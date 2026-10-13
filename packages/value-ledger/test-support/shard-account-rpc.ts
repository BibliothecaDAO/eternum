/** Network boundary for a fresh shard account; both Worker bundles execute the real join and signing code. */
export function shardAccountRpc(account: { address: string; classHash: string; chainId: string }) {
  let deployed = false;
  let receipts = 0;
  return {
    get deployed() {
      return deployed;
    },
    get receipts() {
      return receipts;
    },
    respond(id: number, method: string): Response | undefined {
      if ((method === "starknet_getClassHashAt" && !deployed) || method === "starknet_getNonce")
        return Response.json({ jsonrpc: "2.0", id, error: { code: 20, message: "Contract not found" } });
      if (method === "starknet_addDeployAccountTransaction") deployed = true;
      if (method === "starknet_getTransactionReceipt") receipts++;
      const results: Record<string, unknown> = {
        starknet_chainId: account.chainId,
        starknet_getClassHashAt: account.classHash,
        starknet_estimateFee: [
          {
            l1_gas_consumed: "0x0",
            l1_gas_price: "0x0",
            l1_data_gas_consumed: "0x0",
            l1_data_gas_price: "0x0",
            l2_gas_consumed: "0x64",
            l2_gas_price: "0x1",
            overall_fee: "0x64",
            unit: "FRI",
          },
        ],
        starknet_addDeployAccountTransaction: { transaction_hash: "0x123", contract_address: account.address },
        starknet_getTransactionStatus: { finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED" },
        starknet_getTransactionReceipt: {
          transaction_hash: "0x123",
          type: "DEPLOY_ACCOUNT",
          finality_status: "ACCEPTED_ON_L2",
          execution_status: "SUCCEEDED",
          actual_fee: { amount: "0x0", unit: "FRI" },
          events: [],
          messages_sent: [],
          execution_resources: {},
          contract_address: account.address,
        },
      };
      const result = results[method];
      return result === undefined ? undefined : Response.json({ jsonrpc: "2.0", id, result });
    },
  };
}
