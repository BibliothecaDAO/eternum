import type { Invoke } from "./transaction";

export const fixture = (): Invoke => ({
  type: "INVOKE",
  version: "0x3",
  sender_address: "0x123",
  nonce: "0x1",
  tip: "0x0",
  signature: ["0x1", "0x2", "0x3"],
  calldata: ["0x1", "0x456", "0x789", "0x1", "0x1"],
  resource_bounds: {
    l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
    l2_gas: { max_amount: "0x47868c00", max_price_per_unit: "0x1" },
    l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
  },
  paymaster_data: [],
  account_deployment_data: [],
  nonce_data_availability_mode: "L1",
  fee_data_availability_mode: "L1",
});
