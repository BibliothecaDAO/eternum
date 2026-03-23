import { cairo, type Call } from "starknet";
import { DEFAULT_DEADLINE_OFFSET } from "../constants";

export interface AddLiquidityProps {
  ammAddress: string;
  tokenAddress: string;
  lordsAmount: bigint;
  tokenAmount: bigint;
  lordsMin: bigint;
  tokenMin: bigint;
  deadline?: number;
}

export interface AddLiquidityWithApprovalProps extends AddLiquidityProps {
  lordsAddress: string;
}

export interface RemoveLiquidityProps {
  ammAddress: string;
  tokenAddress: string;
  lpAmount: bigint;
  lordsMin: bigint;
  tokenMin: bigint;
  deadline?: number;
}

function getDeadline(deadline?: number): number {
  return deadline ?? Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_OFFSET;
}

/** Spread a bigint as uint256 low/high felt pair for calldata. */
function u256(value: bigint): [string, string] {
  const v = cairo.uint256(value);
  return [v.low.toString(), v.high.toString()];
}

function buildApproveCall(tokenAddress: string, spender: string, amount: bigint): Call {
  return {
    contractAddress: tokenAddress,
    entrypoint: "approve",
    calldata: [spender, ...u256(amount)],
  };
}

/**
 * Builds starknet.js Call objects for AMM liquidity transactions.
 */
export class LiquidityTransactions {
  /** Build a Call for adding liquidity. */
  addLiquidity(props: AddLiquidityProps): Call {
    return {
      contractAddress: props.ammAddress,
      entrypoint: "add_liquidity",
      calldata: [
        props.tokenAddress,
        ...u256(props.lordsAmount),
        ...u256(props.tokenAmount),
        ...u256(props.lordsMin),
        ...u256(props.tokenMin),
        getDeadline(props.deadline).toString(),
      ],
    };
  }

  /** Build approve LORDS + approve token + add liquidity Calls. */
  addLiquidityWithApproval(props: AddLiquidityWithApprovalProps): Call[] {
    return [
      buildApproveCall(props.lordsAddress, props.ammAddress, props.lordsAmount),
      buildApproveCall(props.tokenAddress, props.ammAddress, props.tokenAmount),
      this.addLiquidity(props),
    ];
  }

  /** Build a Call for removing liquidity. */
  removeLiquidity(props: RemoveLiquidityProps): Call {
    return {
      contractAddress: props.ammAddress,
      entrypoint: "remove_liquidity",
      calldata: [
        props.tokenAddress,
        ...u256(props.lpAmount),
        ...u256(props.lordsMin),
        ...u256(props.tokenMin),
        getDeadline(props.deadline).toString(),
      ],
    };
  }
}
