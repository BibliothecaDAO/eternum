import { hash } from "starknet";

const FIELD = (1n << 251n) + 17n * (1n << 192n) + 1n;
const PLAY = BigInt(hash.getSelectorFromName("play"));
export const STAMP_TAG = "0x56524631";
export interface Bound {
  max_amount: string;
  max_price_per_unit: string;
}
export interface PlayInvoke {
  type: "INVOKE";
  version: string;
  sender_address: string;
  calldata: string[];
  signature: string[];
  nonce: string;
  tip: string;
  resource_bounds: { l1_gas: Bound; l2_gas: Bound; l1_data_gas: Bound };
  proof_facts?: string[];
  paymaster_data: string[];
  account_deployment_data: string[];
  nonce_data_availability_mode: "L1";
  fee_data_availability_mode: "L1";
}
export interface PlayIdentity {
  games: string;
  chainId: string;
  accountClassHash: string;
  l2GasBound: string;
  vrfPublicKey: { x: string; y: string };
}
export function felt(value: unknown): bigint | undefined {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) return undefined;
  const n = BigInt(value);
  return n < FIELD ? n : undefined;
}
const zero = (value: unknown) => felt(value) === 0n;
const canonical = (values: unknown): values is string[] =>
  Array.isArray(values) && values.every((value) => felt(value) !== undefined);
function fixedBounds(bounds: PlayInvoke["resource_bounds"], required: string) {
  const limit = felt(required);
  if (limit === undefined || limit === 0n || limit > (1n << 64n) - 1n) return false;
  return (
    felt(bounds.l2_gas.max_amount) === limit &&
    zero(bounds.l2_gas.max_price_per_unit) &&
    [bounds.l1_gas, bounds.l1_data_gas].every((bound) => zero(bound.max_amount) && zero(bound.max_price_per_unit))
  );
}
function onePlay(call: unknown, games: string): boolean {
  if (!canonical(call) || call.length < 9) return false;
  const game = felt(call[4])!,
    release = felt(call[5])!;
  return (
    felt(call[0]) === 1n &&
    felt(call[1]) === felt(games) &&
    felt(call[2]) === PLAY &&
    felt(call[3]) === BigInt(call.length - 4) &&
    game <= 0xffffffffn &&
    release <= 0xffffffffn &&
    felt(call[7]) === BigInt(call.length - 8)
  );
}
function signedV3(tx: PlayInvoke): boolean {
  return (
    tx.type === "INVOKE" &&
    felt(tx.version) === 3n &&
    !!felt(tx.sender_address) &&
    felt(tx.nonce) !== undefined &&
    canonical(tx.signature) &&
    tx.signature.length === 3
  );
}
function feeFree(tx: PlayInvoke, required: string): boolean {
  return (
    zero(tx.tip) &&
    (tx.proof_facts === undefined || (Array.isArray(tx.proof_facts) && tx.proof_facts.length === 0)) &&
    Array.isArray(tx.paymaster_data) &&
    tx.paymaster_data.length === 0 &&
    Array.isArray(tx.account_deployment_data) &&
    tx.account_deployment_data.length === 0 &&
    tx.nonce_data_availability_mode === "L1" &&
    tx.fee_data_availability_mode === "L1" &&
    fixedBounds(tx.resource_bounds, required)
  );
}
export function playInvoke(value: unknown, identity: PlayIdentity): PlayInvoke | undefined {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const tx = value as PlayInvoke;
    if (!signedV3(tx) || !onePlay(tx.calldata, identity.games) || !feeFree(tx, identity.l2GasBound)) return undefined;
    return tx;
  } catch {
    return undefined;
  }
}
