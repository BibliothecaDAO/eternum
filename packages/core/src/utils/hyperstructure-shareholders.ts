import { ContractAddress, type ContractAddress as ContractAddressValue } from "@bibliothecadao/types";

import { cairoTupleMembers } from "../sync/cairo-tuple";

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

// RECS stores the tuple as an array; Herald rows keep starknet.js' numeric-key record.
const shareholderTupleMembers = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  try {
    return cairoTupleMembers(value, 2);
  } catch {
    return [];
  }
};

const decodeShareholderTuple = (value: unknown): HyperstructureShare => {
  const members = shareholderTupleMembers(value);
  if (members.length !== 2) {
    throw new Error("Hyperstructure shareholder tuple must contain address and basis points");
  }

  return {
    playerAddress: ContractAddress(decodeInteger(members[0], "Hyperstructure shareholder address")),
    basisPoints: decodeInteger(members[1], "Hyperstructure shareholder basis points"),
  };
};

export const decodeHyperstructureShares = (value: unknown): HyperstructureShare[] => {
  if (!Array.isArray(value)) {
    throw new Error("HyperstructureShareholders.shareholders is not an array");
  }
  return value.map(decodeShareholderTuple);
};
