import { CallData, cairo, type Call } from "starknet";
import { DEFAULT_DEADLINE_OFFSET } from "../constants";

export function resolveDeadline(deadline?: number): number {
  return deadline ?? Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_OFFSET;
}

export function toUint256(value: bigint) {
  return cairo.uint256(value);
}

export function buildApproveCall(tokenAddress: string, spender: string, amount: bigint): Call {
  return {
    contractAddress: tokenAddress,
    entrypoint: "approve",
    calldata: CallData.compile([spender, toUint256(amount)]),
  };
}
