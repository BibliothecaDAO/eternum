import { cairo, type Call } from "starknet";
import { DEFAULT_DEADLINE_OFFSET } from "../constants";

export interface SwapLordsForTokenProps {
  ammAddress: string;
  tokenAddress: string;
  lordsAmount: bigint;
  minTokenOut: bigint;
  deadline?: number;
}

export interface SwapTokenForLordsProps {
  ammAddress: string;
  tokenAddress: string;
  tokenAmount: bigint;
  minLordsOut: bigint;
  deadline?: number;
}

export interface SwapTokenForTokenProps {
  ammAddress: string;
  tokenInAddress: string;
  tokenOutAddress: string;
  amountIn: bigint;
  minAmountOut: bigint;
  deadline?: number;
}

export interface SwapWithApprovalProps extends SwapLordsForTokenProps {
  lordsAddress: string;
}

export interface SwapTokenForLordsWithApprovalProps extends SwapTokenForLordsProps {}

export interface SwapTokenForTokenWithApprovalProps extends SwapTokenForTokenProps {}

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
 * Builds starknet.js Call objects for AMM swap transactions.
 */
export class SwapTransactions {
  /** Build a Call for swapping LORDS -> token. */
  swapLordsForToken(props: SwapLordsForTokenProps): Call {
    return {
      contractAddress: props.ammAddress,
      entrypoint: "swap_lords_for_token",
      calldata: [
        props.tokenAddress,
        ...u256(props.lordsAmount),
        ...u256(props.minTokenOut),
        getDeadline(props.deadline).toString(),
      ],
    };
  }

  /** Build a Call for swapping token -> LORDS. */
  swapTokenForLords(props: SwapTokenForLordsProps): Call {
    return {
      contractAddress: props.ammAddress,
      entrypoint: "swap_token_for_lords",
      calldata: [
        props.tokenAddress,
        ...u256(props.tokenAmount),
        ...u256(props.minLordsOut),
        getDeadline(props.deadline).toString(),
      ],
    };
  }

  /** Build a Call for swapping token -> token (routes through LORDS). */
  swapTokenForToken(props: SwapTokenForTokenProps): Call {
    return {
      contractAddress: props.ammAddress,
      entrypoint: "swap_token_for_token",
      calldata: [
        props.tokenInAddress,
        props.tokenOutAddress,
        ...u256(props.amountIn),
        ...u256(props.minAmountOut),
        getDeadline(props.deadline).toString(),
      ],
    };
  }

  /** Build approve + swap LORDS -> token Calls. */
  swapLordsForTokenWithApproval(props: SwapWithApprovalProps): Call[] {
    return [buildApproveCall(props.lordsAddress, props.ammAddress, props.lordsAmount), this.swapLordsForToken(props)];
  }

  /** Build approve + swap token -> LORDS Calls. */
  swapTokenForLordsWithApproval(props: SwapTokenForLordsWithApprovalProps): Call[] {
    return [buildApproveCall(props.tokenAddress, props.ammAddress, props.tokenAmount), this.swapTokenForLords(props)];
  }

  /** Build approve + swap token -> token Calls. */
  swapTokenForTokenWithApproval(props: SwapTokenForTokenWithApprovalProps): Call[] {
    return [buildApproveCall(props.tokenInAddress, props.ammAddress, props.amountIn), this.swapTokenForToken(props)];
  }
}
