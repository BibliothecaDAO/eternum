import { GAME_CHAIN_NAMES, type GameChain } from "@realms-world/chain";
import { constants, shortString } from "starknet";

export type S2Chain = GameChain;

export function assertRelayChainIds(ledgerChainId: string, s2ChainId: string, s2Chain: S2Chain): void {
  assertChainId(ledgerChainId, constants.StarknetChainId.SN_MAIN, "LEDGER_RPC_URL", "Starknet mainnet");
  assertChainId(s2ChainId, shortString.encodeShortString(GAME_CHAIN_NAMES[s2Chain]), "S2_RPC_URL", s2Chain);
}

function assertChainId(actual: string, expected: string, environmentName: string, label: string): void {
  if (BigInt(actual) !== BigInt(expected)) {
    throw new Error(`${environmentName} is not ${label} (chain id ${actual}, expected ${expected})`);
  }
}
