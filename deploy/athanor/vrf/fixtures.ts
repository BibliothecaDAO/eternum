import { hash } from "starknet";
import type { PlayIdentity, PlayInvoke } from "./transaction";
export const identity: PlayIdentity & { guardianPublicKey: string } = {
  games: "0xabc",
  chainId: "0x534e5f54455354",
  accountClassHash: "0x123",
  guardianPublicKey: "0x456",
  l2GasBound: "0x47868c00",
  vrfPublicKey: { x: "0x1", y: "0x2" },
};
export function invoke(): PlayInvoke {
  return {
    type: "INVOKE",
    version: "0x3",
    sender_address: "0x42",
    nonce: "0x0",
    tip: "0x0",
    signature: ["0x1", "0x2", "0x3"],
    calldata: ["0x1", identity.games, hash.getSelectorFromName("play"), "0x5", "0x1", "0x1", "0x123", "0x1", "0x0"],
    resource_bounds: {
      l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
      l2_gas: { max_amount: identity.l2GasBound, max_price_per_unit: "0x0" },
      l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
    },
    paymaster_data: [],
    account_deployment_data: [],
    nonce_data_availability_mode: "L1",
    fee_data_availability_mode: "L1",
  };
}
