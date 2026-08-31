import { constants } from "starknet";

export type S2Chain = "madara" | "appchain";

const S2_CHAIN_IDS: Record<S2Chain, string> = {
  appchain: "0x57505f5245414c4d535f444556",
  madara: "0x57505f5245414c4d535f4d41444152415f4c4142",
};

export function assertRelayChainIds(ledgerChainId: string, s2ChainId: string, s2Chain: S2Chain): void {
  assertChainId(ledgerChainId, constants.StarknetChainId.SN_MAIN, "LEDGER_RPC_URL", "Starknet mainnet");
  assertChainId(s2ChainId, S2_CHAIN_IDS[s2Chain], "S2_RPC_URL", s2Chain);
}

function assertChainId(actual: string, expected: string, environmentName: string, label: string): void {
  if (BigInt(actual) !== BigInt(expected)) {
    throw new Error(`${environmentName} is not ${label} (chain id ${actual}, expected ${expected})`);
  }
}
