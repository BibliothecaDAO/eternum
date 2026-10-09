import type { SiwsTypedData, WalletDeployment } from "@realms-world/identity";
import { ec, hash, typedData, type TypedData } from "starknet";

// Published Ready Account 0.4.0/0.5.0 and Braavos Base Account 1.2.0 only.
// Constructor decoding is specific to these classes; unrecognized account/signer types require deployment.
const ACCOUNT_CLASSES = new Map([
  [felt("0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f"), "ready"],
  [felt("0x073414441639dcd11d1846f287650a00c60c416b9d3ba45d31c651672125b2c2"), "ready"],
  [felt("0x03d16c7a9a60b0593bd202f660a28c5d76e0403601d9ccc7e4fa253b6a70c201"), "braavos"],
]);

/** This runs only after mainnet confirms absence. Address, constructor authorities and every required signature bind together. */
export const verifyUndeployedProof = (
  message: SiwsTypedData,
  signature: string[],
  address: string,
  deployment: WalletDeployment,
): boolean => {
  try {
    const account = ACCOUNT_CLASSES.get(felt(deployment.classHash));
    if (!account) return false;
    const calldata = deployment.constructorCalldata.map(felt);
    const expected = hash.calculateContractAddressFromHash(
      felt(deployment.salt),
      felt(deployment.classHash),
      calldata,
      0,
    );
    if (felt(expected) !== felt(address)) return false;
    const keys = account === "ready" ? readyKeys(calldata) : braavosKeys(calldata);
    const signatures = account === "ready" ? readySignatures(signature, keys) : braavosSignatures(signature);
    const digest = typedData.getMessageHash(message as unknown as TypedData, address);
    return keys.every((key, index) => verifiesStarkKey(key, signatures[index]!, digest));
  } catch {
    return false;
  }
};

const readyKeys = (fields: string[]): string[] => {
  if (fields[0] !== "0x0" || !fields[1] || fields[1] === "0x0") throw new Error("unsupported_owner");
  if (fields.length === 3 && fields[2] === "0x1") return [fields[1]];
  if (fields.length === 5 && fields[2] === "0x0" && fields[3] === "0x0" && fields[4] !== "0x0")
    return [fields[1], fields[4]!];
  throw new Error("unsupported_guardian");
};
const braavosKeys = (fields: string[]) => {
  if (fields.length !== 1 || fields[0] === "0x0") throw new Error("unsupported_braavos_constructor");
  return [fields[0]!];
};
const readySignatures = (raw: string[], keys: string[]): string[][] => {
  const fields = raw.map(felt);
  if (fields.length === keys.length * 2) return keys.map((_, index) => fields.slice(index * 2, index * 2 + 2));
  if (fields.length !== 1 + 4 * keys.length || BigInt(fields[0]!) !== BigInt(keys.length))
    throw new Error("invalid_signature_count");
  return keys.map((key, index) => {
    const offset = 1 + 4 * index;
    if (fields[offset] !== "0x0" || fields[offset + 1] !== key) throw new Error("wrong_signature_authority");
    return fields.slice(offset + 2, offset + 4);
  });
};
const braavosSignatures = (raw: string[]): string[][] => {
  const fields = raw.map(felt);
  if (fields.length === 2) return [fields];
  if (fields.length === 3 && fields[0] === "0x1") return [fields.slice(1)];
  throw new Error("unsupported_braavos_signature");
};
const verifiesStarkKey = (key: string, signature: string[], digest: string) => {
  const signed = new ec.starkCurve.Signature(BigInt(signature[0]!), BigInt(signature[1]!));
  const x = BigInt(key).toString(16).padStart(64, "0");
  // Starknet constructors store x only; either curve-point parity represents that same authority.
  return ["02", "03"].some((prefix) => ec.starkCurve.verify(signed, digest, `0x${prefix}${x}`));
};
function felt(value: string): string {
  if (typeof value !== "string" || !/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) throw new Error("invalid_felt");
  const n = BigInt(value);
  if (n >= 2n ** 251n + 17n * 2n ** 192n + 1n) throw new Error("invalid_felt");
  return `0x${n.toString(16)}`;
}
