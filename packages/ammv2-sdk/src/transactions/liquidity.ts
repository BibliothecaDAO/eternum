import { CallData, type Call } from "starknet";
import { buildApproveCall, resolveDeadline, toUint256 } from "./shared";

export interface AddLiquidityProps {
  routerAddress: string;
  tokenAAddress: string;
  tokenBAddress: string;
  amountADesired: bigint;
  amountBDesired: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  recipientAddress: string;
  deadline?: number;
}

export interface RemoveLiquidityProps {
  routerAddress: string;
  tokenAAddress: string;
  tokenBAddress: string;
  lpTokenAddress: string;
  liquidity: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  recipientAddress: string;
  deadline?: number;
}

export class LiquidityTransactions {
  addLiquidity(props: AddLiquidityProps): Call {
    return {
      contractAddress: props.routerAddress,
      entrypoint: "add_liquidity",
      calldata: CallData.compile([
        props.tokenAAddress,
        props.tokenBAddress,
        toUint256(props.amountADesired),
        toUint256(props.amountBDesired),
        toUint256(props.amountAMin),
        toUint256(props.amountBMin),
        props.recipientAddress,
        resolveDeadline(props.deadline),
      ]),
    };
  }

  addLiquidityWithApproval(props: AddLiquidityProps): Call[] {
    return [
      buildApproveCall(props.tokenAAddress, props.routerAddress, props.amountADesired),
      buildApproveCall(props.tokenBAddress, props.routerAddress, props.amountBDesired),
      this.addLiquidity(props),
    ];
  }

  removeLiquidity(props: RemoveLiquidityProps): Call {
    return {
      contractAddress: props.routerAddress,
      entrypoint: "remove_liquidity",
      calldata: CallData.compile([
        props.tokenAAddress,
        props.tokenBAddress,
        toUint256(props.liquidity),
        toUint256(props.amountAMin),
        toUint256(props.amountBMin),
        props.recipientAddress,
        resolveDeadline(props.deadline),
      ]),
    };
  }

  removeLiquidityWithApproval(props: RemoveLiquidityProps): Call[] {
    return [buildApproveCall(props.lpTokenAddress, props.routerAddress, props.liquidity), this.removeLiquidity(props)];
  }
}
