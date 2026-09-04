import { ContractAddress, type ContractAddress as ContractAddressValue } from "@bibliothecadao/types";

interface HyperstructureShare {
  playerAddress: ContractAddressValue;
  basisPoints: bigint;
}

const decodeInteger = (value: unknown, field: string): bigint => {
  if (!["bigint", "number", "string"].includes(typeof value)) {
    throw new Error(`${field} is not a scalar`);
  }

  try {
    return BigInt(value as bigint | number | string);
  } catch {
    throw new Error(`${field} is not an integer`);
  }
};

const decodeShareholderTuple = (value: unknown): HyperstructureShare => {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error("Hyperstructure shareholder tuple must contain address and basis points");
  }

  return {
    playerAddress: ContractAddress(decodeInteger(value[0], "Hyperstructure shareholder address")),
    basisPoints: decodeInteger(value[1], "Hyperstructure shareholder basis points"),
  };
};

export const decodeHyperstructureShares = (value: unknown): HyperstructureShare[] => {
  if (!Array.isArray(value)) {
    throw new Error("HyperstructureShareholders.shareholders is not an array");
  }
  return value.map(decodeShareholderTuple);
};
