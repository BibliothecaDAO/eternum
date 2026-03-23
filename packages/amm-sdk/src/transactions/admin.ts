import { cairo, type Call } from "starknet";

export interface CreatePoolProps {
  ammAddress: string;
  tokenAddress: string;
  lpFeeNum: bigint;
  lpFeeDenom: bigint;
  protocolFeeNum: bigint;
  protocolFeeDenom: bigint;
}

export interface SetPoolFeeProps {
  ammAddress: string;
  tokenAddress: string;
  lpFeeNum: bigint;
  lpFeeDenom: bigint;
  protocolFeeNum: bigint;
  protocolFeeDenom: bigint;
}

export interface SetFeeRecipientProps {
  ammAddress: string;
  recipient: string;
}

export interface SetPausedProps {
  ammAddress: string;
  paused: boolean;
}

/** Spread a bigint as uint256 low/high felt pair for calldata. */
function u256(value: bigint): [string, string] {
  const v = cairo.uint256(value);
  return [v.low.toString(), v.high.toString()];
}

/**
 * Builds starknet.js Call objects for AMM admin transactions.
 */
export class AdminTransactions {
  /** Build a Call for creating a new pool. */
  createPool(props: CreatePoolProps): Call {
    return {
      contractAddress: props.ammAddress,
      entrypoint: "create_pool",
      calldata: [
        props.tokenAddress,
        ...u256(props.lpFeeNum),
        ...u256(props.lpFeeDenom),
        ...u256(props.protocolFeeNum),
        ...u256(props.protocolFeeDenom),
      ],
    };
  }

  /** Build a Call for setting pool fee parameters. */
  setPoolFee(props: SetPoolFeeProps): Call {
    return {
      contractAddress: props.ammAddress,
      entrypoint: "set_pool_fee",
      calldata: [
        props.tokenAddress,
        ...u256(props.lpFeeNum),
        ...u256(props.lpFeeDenom),
        ...u256(props.protocolFeeNum),
        ...u256(props.protocolFeeDenom),
      ],
    };
  }

  /** Build a Call for setting the fee recipient. */
  setFeeRecipient(props: SetFeeRecipientProps): Call {
    return {
      contractAddress: props.ammAddress,
      entrypoint: "set_fee_recipient",
      calldata: [props.recipient],
    };
  }

  /** Build a Call for pausing/unpausing the AMM. */
  setPaused(props: SetPausedProps): Call {
    return {
      contractAddress: props.ammAddress,
      entrypoint: "set_paused",
      calldata: [props.paused ? "1" : "0"],
    };
  }
}
