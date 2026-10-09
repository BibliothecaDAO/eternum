import { hash } from "starknet";
import { GAME_ENTRYPOINTS } from "./entrypoints";

const FIELD = (1n << 251n) + 17n * (1n << 192n) + 1n;
const ENTRIES = new Map(GAME_ENTRYPOINTS.map((entry) => [BigInt(hash.getSelectorFromName(entry.name)), entry]));
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
  nonce_data_availability_mode: "L1" | "L2";
  fee_data_availability_mode: "L1" | "L2";
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
function oneGameCall(call: unknown, games: string) {
  if (
    !canonical(call) ||
    call.length < 4 ||
    felt(call[0]) !== 1n ||
    felt(call[1]) !== felt(games) ||
    felt(call[3]) !== BigInt(call.length - 4)
  )
    return undefined;
  const entry = ENTRIES.get(felt(call[2])!);
  if (!entry) return undefined;
  if (
    entry.name === "play" &&
    (call.length < 9 ||
      felt(call[4])! > 0xffffffffn ||
      felt(call[5])! > 0xffffffffn ||
      felt(call[7]) !== BigInt(call.length - 8))
  )
    return undefined;
  return entry;
}
function signedV3(tx: PlayInvoke): boolean {
  return (
    tx.type === "INVOKE" &&
    felt(tx.version) === 3n &&
    !!felt(tx.sender_address) &&
    felt(tx.nonce) !== undefined &&
    canonical(tx.signature) &&
    tx.signature.length > 0
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
export interface GameInvocation {
  transaction: PlayInvoke;
  entrypoint: (typeof GAME_ENTRYPOINTS)[number];
}
function validBounds(bounds: PlayInvoke["resource_bounds"]): boolean {
  return [bounds.l1_gas, bounds.l2_gas, bounds.l1_data_gas].every((bound) => {
    const amount = felt(bound.max_amount),
      price = felt(bound.max_price_per_unit);
    return amount !== undefined && amount <= (1n << 64n) - 1n && price !== undefined && price <= (1n << 128n) - 1n;
  });
}
function validAuxiliaryData(tx: PlayInvoke): boolean {
  return (
    canonical(tx.paymaster_data) &&
    canonical(tx.account_deployment_data) &&
    (tx.proof_facts === undefined || canonical(tx.proof_facts)) &&
    ["L1", "L2"].includes(tx.nonce_data_availability_mode) &&
    ["L1", "L2"].includes(tx.fee_data_availability_mode) &&
    zero(tx.tip)
  );
}
export function gameInvoke(value: unknown, identity: PlayIdentity): GameInvocation | undefined {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const tx = value as PlayInvoke;
    if (!signedV3(tx)) return undefined;
    const entrypoint = oneGameCall(tx.calldata, identity.games);
    if (!entrypoint || !validBounds(tx.resource_bounds) || !validAuxiliaryData(tx)) return undefined;
    if (entrypoint.stamp && (tx.signature.length !== 3 || !feeFree(tx, identity.l2GasBound))) return undefined;
    return { transaction: tx, entrypoint };
  } catch {
    return undefined;
  }
}
