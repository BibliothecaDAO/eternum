import { assertChainId, type GameChain } from "@realms-world/chain";

export type S2Chain = GameChain;

export function assertRelayChainIds(ledgerChainId: string, s2ChainId: string, s2Chain: S2Chain): void {
  assertChainId(ledgerChainId, "mainnet", "LEDGER_RPC_URL");
  assertChainId(s2ChainId, s2Chain, "S2_RPC_URL");
}
