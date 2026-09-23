import { hash } from "starknet";

interface ShardIdentity {
  accountClassHash: string;
  guardianPublicKey: string;
}
type Transaction = Record<string, unknown>;
const IS_DEVICE = hash.starknetKeccak("is_device");
const REVOKE_DEVICE = hash.starknetKeccak("revoke_device");
const FIELD = 2n ** 251n + 17n * 2n ** 192n + 1n;

function felt(value: unknown): bigint | undefined {
  if (typeof value !== "string" || !/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) return undefined;
  const n = BigInt(value);
  return n < FIELD ? n : undefined;
}
function felts(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => felt(v) !== undefined);
}
function equal(a: unknown, b: unknown) {
  const x = felt(a),
    y = felt(b);
  return x !== undefined && y !== undefined && x === y;
}

async function permitsAccountTransaction(
  tx: unknown,
  identity: ShardIdentity,
  classAt: (sender: string) => Promise<string>,
  query = false,
): Promise<boolean> {
  if (!tx || typeof tx !== "object" || Array.isArray(tx)) return false;
  const t = tx as Transaction;
  const version = felt(t.version);
  if (version !== 3n && !(query && version === (1n << 128n) + 3n)) return false;
  if (!equal(t.tip, "0x0") || !felts(t.signature)) return false;
  if (t.type === "DEPLOY_ACCOUNT") return permitsDeploy(t, identity, query);
  if (t.type !== "INVOKE" || !permitsSelfCall(t, query)) return false;
  try {
    return equal(await classAt(t.sender_address as string), identity.accountClassHash);
  } catch {
    return false;
  }
}

function permitsDeploy(tx: Transaction, identity: ShardIdentity, query: boolean): boolean {
  const calldata = tx.constructor_calldata;
  return (
    equal(tx.class_hash, identity.accountClassHash) &&
    felts(calldata) &&
    calldata.length === 2 &&
    equal(calldata[1], identity.guardianPublicKey) &&
    equal(tx.contract_address_salt, calldata[0]) &&
    ((tx.signature as string[]).length === 5 || (query && (tx.signature as string[]).length === 0))
  );
}

function permitsSelfCall(tx: Transaction, query: boolean): boolean {
  const calldata = tx.calldata;
  if (!felts(calldata) || !equal(calldata[0], "0x1") || !equal(calldata[1], tx.sender_address)) return false;
  const signature = tx.signature as string[];
  if (felt(calldata[2]) === IS_DEVICE) {
    return (
      calldata.length === 5 &&
      equal(calldata[3], "0x1") &&
      ((signature.length === 5 && equal(calldata[4], signature[0])) || (query && signature.length === 0))
    );
  }
  if (felt(calldata[2]) === REVOKE_DEVICE)
    return (
      calldata.length === 7 &&
      equal(calldata[3], "0x3") &&
      (signature.length === 3 || (query && signature.length === 0))
    );
  return false;
}

export async function permitsAccountRequest(
  call: Record<string, unknown>,
  identity: ShardIdentity,
  classAt: (sender: string) => Promise<string>,
): Promise<boolean> {
  const params = call.params;
  if (!params || typeof params !== "object") return false;
  const named = params as Record<string, unknown>;
  const first = Array.isArray(params) ? params[0] : undefined;
  if (call.method === "starknet_addDeployAccountTransaction") {
    const tx = (first ?? named.deploy_account_transaction) as Transaction | undefined;
    return tx?.type === "DEPLOY_ACCOUNT" && permitsAccountTransaction(tx, identity, classAt);
  }
  if (call.method === "starknet_addInvokeTransaction") {
    const tx = (first ?? named.invoke_transaction) as Transaction | undefined;
    return tx?.type === "INVOKE" && permitsAccountTransaction(tx, identity, classAt);
  }
  // Starknet.js estimates these operations before signing the final V3 transaction; it does not simulate them.
  if (call.method === "starknet_estimateFee") {
    const transactions = first ?? named.request;
    if (!Array.isArray(transactions) || transactions.length !== 1) return false;
    const flags = Array.isArray(params) ? params[1] : named.simulation_flags;
    const tx = transactions[0] as Transaction;
    if (!tx || typeof tx !== "object" || Array.isArray(tx)) return false;
    if (
      Array.isArray(tx.signature) &&
      tx.signature.length === 0 &&
      (!Array.isArray(flags) || !flags.includes("SKIP_VALIDATE") || felt(tx.version) !== (1n << 128n) + 3n)
    )
      return false;
    return permitsAccountTransaction(tx, identity, classAt, true);
  }
  return false;
}
