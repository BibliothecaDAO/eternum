import { hash, type Calldata } from "starknet";

import { L2_GAS_BOUND } from "./wire";

interface Bound {
  max_amount: string;
  max_price_per_unit: string;
}
export interface Invoke {
  type: "INVOKE";
  version: string;
  sender_address: string;
  calldata: string[];
  signature: string[];
  nonce: string;
  tip: string;
  resource_bounds: { l1_gas: Bound; l2_gas: Bound; l1_data_gas: Bound };
  paymaster_data: string[];
  account_deployment_data: string[];
  nonce_data_availability_mode: "L1" | "L2";
  fee_data_availability_mode: "L1" | "L2";
}

/** The signature is intentionally absent: appending the proof must leave the player's hash unchanged. */
export function invokeHash(tx: Invoke, chain: string): string {
  if (tx.type !== "INVOKE" || BigInt(tx.version) !== 3n) throw new Error("Only ordinary V3 invokes are stamped");
  const bound = (value: Bound) => ({
    max_amount: BigInt(value.max_amount),
    max_price_per_unit: BigInt(value.max_price_per_unit),
  });
  const mode = (value: "L1" | "L2") => {
    if (value !== "L1" && value !== "L2") throw new Error("Invalid data-availability mode");
    return value === "L1" ? 0 : 1;
  };
  return hash.calculateInvokeTransactionHash({
    senderAddress: tx.sender_address,
    version: "0x3",
    compiledCalldata: tx.calldata as Calldata,
    chainId: chain as Parameters<typeof hash.calculateInvokeTransactionHash>[0]["chainId"],
    nonce: tx.nonce,
    resourceBounds: {
      l1_gas: bound(tx.resource_bounds.l1_gas),
      l2_gas: bound(tx.resource_bounds.l2_gas),
      l1_data_gas: bound(tx.resource_bounds.l1_data_gas),
    },
    tip: tx.tip,
    paymasterData: tx.paymaster_data,
    accountDeploymentData: tx.account_deployment_data,
    nonceDataAvailabilityMode: mode(tx.nonce_data_availability_mode),
    feeDataAvailabilityMode: mode(tx.fee_data_availability_mode),
  });
}

export function isGamesInvoke(tx: unknown, games: string): tx is Invoke {
  if (!tx || typeof tx !== "object" || Array.isArray(tx)) return false;
  const candidate = tx as Partial<Invoke>;
  try {
    const calldata = candidate.calldata;
    return (
      candidate.type === "INVOKE" &&
      BigInt(candidate.version!) === 3n &&
      BigInt(candidate.tip!) === 0n &&
      candidate.paymaster_data?.length === 0 &&
      candidate.account_deployment_data?.length === 0 &&
      candidate.nonce_data_availability_mode === "L1" &&
      candidate.fee_data_availability_mode === "L1" &&
      fixedBounds(candidate.resource_bounds!) &&
      Array.isArray(candidate.signature) &&
      candidate.signature.length === 3 &&
      Array.isArray(calldata) &&
      calldata.length >= 4 &&
      BigInt(calldata[0]) === 1n &&
      BigInt(calldata[1]) === BigInt(games) &&
      ["play", "probe", "create_explorer", "prepare_explorer", "explore", "settle_season"].some(
        (name) => BigInt(calldata[2]!) === BigInt(hash.getSelectorFromName(name)),
      ) &&
      BigInt(calldata[3]) === BigInt(calldata.length - 4)
    );
  } catch {
    return false;
  }
}

function fixedBounds(bounds: Invoke["resource_bounds"]) {
  return (
    BigInt(bounds.l2_gas.max_amount) === L2_GAS_BOUND &&
    BigInt(bounds.l2_gas.max_price_per_unit) === 0n &&
    [bounds.l1_gas, bounds.l1_data_gas].every(
      (bound) => BigInt(bound.max_amount) === 0n && BigInt(bound.max_price_per_unit) === 0n,
    )
  );
}
