import { CallData, type Call } from "starknet";
import { buildApproveCall, resolveDeadline, toUint256 } from "./shared";

export interface SwapExactTokensForTokensProps {
  routerAddress: string;
  amountIn: bigint;
  minAmountOut: bigint;
  path: string[];
  recipientAddress: string;
  deadline?: number;
}

export interface SwapExactTokensForTokensWithApprovalProps extends SwapExactTokensForTokensProps {
  tokenInAddress: string;
}

export interface SwapTokensForExactTokensProps {
  routerAddress: string;
  amountOut: bigint;
  maxAmountIn: bigint;
  path: string[];
  recipientAddress: string;
  deadline?: number;
}

export interface SwapTokensForExactTokensWithApprovalProps extends SwapTokensForExactTokensProps {
  tokenInAddress: string;
}

export class SwapTransactions {
  swapExactTokensForTokens(props: SwapExactTokensForTokensProps): Call {
    return {
      contractAddress: props.routerAddress,
      entrypoint: "swap_exact_tokens_for_tokens",
      calldata: CallData.compile([
        toUint256(props.amountIn),
        toUint256(props.minAmountOut),
        props.path,
        props.recipientAddress,
        resolveDeadline(props.deadline),
      ]),
    };
  }

  swapExactTokensForTokensWithApproval(props: SwapExactTokensForTokensWithApprovalProps): Call[] {
    return [
      buildApproveCall(props.tokenInAddress, props.routerAddress, props.amountIn),
      this.swapExactTokensForTokens(props),
    ];
  }

  swapTokensForExactTokens(props: SwapTokensForExactTokensProps): Call {
    return {
      contractAddress: props.routerAddress,
      entrypoint: "swap_tokens_for_exact_tokens",
      calldata: CallData.compile([
        toUint256(props.amountOut),
        toUint256(props.maxAmountIn),
        props.path,
        props.recipientAddress,
        resolveDeadline(props.deadline),
      ]),
    };
  }

  swapTokensForExactTokensWithApproval(props: SwapTokensForExactTokensWithApprovalProps): Call[] {
    return [
      buildApproveCall(props.tokenInAddress, props.routerAddress, props.maxAmountIn),
      this.swapTokensForExactTokens(props),
    ];
  }
}
