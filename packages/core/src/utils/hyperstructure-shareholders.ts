import { ContractAddress, type ContractAddress as ContractAddressValue } from "@bibliothecadao/types";

interface HyperstructureShare {
  playerAddress: ContractAddressValue;
  basisPoints: bigint;
}

const unwrapValue = (value: unknown): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.hasOwn(value, "value")
    ? (value as { value: unknown }).value
    : value;

const decodeInteger = (value: unknown, field: string): bigint => {
  const scalar = unwrapValue(value);
  if (!["bigint", "number", "string"].includes(typeof scalar)) {
    throw new Error(`${field} is not a scalar`);
  }

  try {
    return BigInt(scalar as bigint | number | string);
  } catch {
    throw new Error(`${field} is not an integer`);
  }
};

const decodeShareholderTuple = (value: unknown): HyperstructureShare => {
  const tuple = unwrapValue(value);
  if (!Array.isArray(tuple) || tuple.length !== 2) {
    throw new Error("Hyperstructure shareholder tuple must contain address and basis points");
  }

  return {
    playerAddress: ContractAddress(decodeInteger(tuple[0], "Hyperstructure shareholder address")),
    basisPoints: decodeInteger(tuple[1], "Hyperstructure shareholder basis points"),
  };
};

export const decodeHyperstructureShares = (value: unknown): HyperstructureShare[] => {
  const shares = unwrapValue(value);
  if (!Array.isArray(shares)) {
    throw new Error("HyperstructureShareholders.shareholders is not an array");
  }
  return shares.map(decodeShareholderTuple);
};
