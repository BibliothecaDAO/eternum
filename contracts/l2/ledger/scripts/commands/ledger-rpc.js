import { assertProviderChain } from "@realms-world/chain/chain-guard";
import { RpcProvider } from "starknet";

export function requireLedgerRpcUrl() {
  const rpcUrl = process.env.LEDGER_RPC_URL?.trim();
  if (!rpcUrl) throw new Error("LEDGER_RPC_URL is required");
  return rpcUrl;
}

export async function assertLedgerRpc() {
  const rpcUrl = requireLedgerRpcUrl();
  process.env.STARKNET_RPC = rpcUrl;
  await assertProviderChain(new RpcProvider({ nodeUrl: rpcUrl }), "mainnet", "LEDGER_RPC_URL");
}
