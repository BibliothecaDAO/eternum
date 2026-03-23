import { getInputPrice } from "@bibliothecadao/amm-sdk";

export interface IndexedPoolState {
  feeDenom: bigint;
  feeNum: bigint;
  lordsReserve: bigint;
  protocolFeeDenom: bigint;
  protocolFeeNum: bigint;
  tokenAddress: string;
  tokenReserve: bigint;
}

export interface SwapMutation {
  amountIn: bigint;
  amountOut: bigint;
  nextLordsReserve: bigint;
  nextTokenReserve: bigint;
  priceAfterSwap: string;
  priceBeforeSwap: string;
  protocolFee: bigint;
  tokenAddress: string;
  tokenIn: string;
  tokenOut: string;
}

interface BuildSwapMutationsParams {
  amountIn: bigint;
  amountOut: bigint;
  lordsAddress: string;
  poolsByToken: Record<string, IndexedPoolState>;
  protocolFee: bigint;
  tokenIn: string;
  tokenOut: string;
}

interface SwapAccountingFailureContext {
  blockNumber: bigint;
  eventIndex: number;
  txHash: string;
}

export class MissingPoolContextError extends Error {
  readonly errorType = "missing_pool_context";

  constructor(
    readonly tokenAddress: string,
    readonly availablePools: string[],
    readonly tokenIn: string,
    readonly tokenOut: string,
  ) {
    super(`pool ${tokenAddress} is missing from swap accounting context`);
    this.name = "MissingPoolContextError";
  }
}

export class RoutedSwapAccountingMismatchError extends Error {
  readonly errorType = "routed_swap_output_mismatch";

  constructor(
    readonly tokenIn: string,
    readonly tokenOut: string,
    readonly amountIn: bigint,
    readonly expectedAmountOut: bigint,
    readonly actualAmountOut: bigint,
  ) {
    super("routed swap output does not match derived pool math");
    this.name = "RoutedSwapAccountingMismatchError";
  }
}

export type SwapAccountingError = MissingPoolContextError | RoutedSwapAccountingMismatchError;

export function buildSwapMutations(params: BuildSwapMutationsParams): SwapMutation[] {
  if (params.tokenIn.toLowerCase() === params.lordsAddress.toLowerCase()) {
    const pool = requirePool(params.poolsByToken, params.tokenOut, params.tokenIn, params.tokenOut);
    return [
      buildDirectSwapMutation({
        amountIn: params.amountIn,
        amountOut: params.amountOut,
        isLordsInput: true,
        pool,
        protocolFee: params.protocolFee,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
      }),
    ];
  }

  if (params.tokenOut.toLowerCase() === params.lordsAddress.toLowerCase()) {
    const pool = requirePool(params.poolsByToken, params.tokenIn, params.tokenIn, params.tokenOut);
    return [
      buildDirectSwapMutation({
        amountIn: params.amountIn,
        amountOut: params.amountOut,
        isLordsInput: false,
        pool,
        protocolFee: params.protocolFee,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
      }),
    ];
  }

  const inputPool = requirePool(params.poolsByToken, params.tokenIn, params.tokenIn, params.tokenOut);
  const outputPool = requirePool(params.poolsByToken, params.tokenOut, params.tokenIn, params.tokenOut);

  const firstHopGrossOutput = getInputPrice(
    inputPool.feeNum,
    inputPool.feeDenom,
    params.amountIn,
    inputPool.tokenReserve,
    inputPool.lordsReserve,
  );
  const firstHopProtocolFee = computeProtocolFee(firstHopGrossOutput, inputPool);
  const firstHopNetOutput = firstHopGrossOutput - firstHopProtocolFee;

  const secondHopGrossOutput = getInputPrice(
    outputPool.feeNum,
    outputPool.feeDenom,
    firstHopNetOutput,
    outputPool.lordsReserve,
    outputPool.tokenReserve,
  );
  const secondHopProtocolFee = computeProtocolFee(secondHopGrossOutput, outputPool);
  const secondHopNetOutput = secondHopGrossOutput - secondHopProtocolFee;

  if (secondHopNetOutput !== params.amountOut) {
    throw new RoutedSwapAccountingMismatchError(
      params.tokenIn,
      params.tokenOut,
      params.amountIn,
      params.amountOut,
      secondHopNetOutput,
    );
  }

  return [
    buildDirectSwapMutation({
      amountIn: params.amountIn,
      amountOut: firstHopNetOutput,
      isLordsInput: false,
      pool: inputPool,
      protocolFee: firstHopProtocolFee,
      tokenIn: params.tokenIn,
      tokenOut: params.lordsAddress,
    }),
    buildDirectSwapMutation({
      amountIn: firstHopNetOutput,
      amountOut: secondHopNetOutput,
      isLordsInput: true,
      pool: outputPool,
      protocolFee: secondHopProtocolFee,
      tokenIn: params.lordsAddress,
      tokenOut: params.tokenOut,
    }),
  ];
}

interface BuildDirectSwapMutationParams {
  amountIn: bigint;
  amountOut: bigint;
  isLordsInput: boolean;
  pool: IndexedPoolState;
  protocolFee: bigint;
  tokenIn: string;
  tokenOut: string;
}

function buildDirectSwapMutation(params: BuildDirectSwapMutationParams): SwapMutation {
  const priceBeforeSwap = computePrice(params.pool.lordsReserve, params.pool.tokenReserve);

  const nextLordsReserve = params.isLordsInput
    ? params.pool.lordsReserve + params.amountIn
    : params.pool.lordsReserve - params.amountOut - params.protocolFee;
  const nextTokenReserve = params.isLordsInput
    ? params.pool.tokenReserve - params.amountOut - params.protocolFee
    : params.pool.tokenReserve + params.amountIn;

  return {
    tokenAddress: params.pool.tokenAddress,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    amountOut: params.amountOut,
    protocolFee: params.protocolFee,
    nextLordsReserve,
    nextTokenReserve,
    priceBeforeSwap,
    priceAfterSwap: computePrice(nextLordsReserve, nextTokenReserve),
  };
}

function computePrice(lordsReserve: bigint, tokenReserve: bigint): string {
  if (tokenReserve === 0n) {
    return "0";
  }

  const scaled = (lordsReserve * 10n ** 18n) / tokenReserve;
  const intPart = scaled / 10n ** 18n;
  const fracPart = scaled % 10n ** 18n;

  return `${intPart}.${fracPart.toString().padStart(18, "0")}`;
}

function computeProtocolFee(outputAmount: bigint, pool: IndexedPoolState): bigint {
  if (pool.protocolFeeNum <= 0n || pool.protocolFeeDenom <= 0n) {
    return 0n;
  }

  return (outputAmount * pool.protocolFeeNum) / pool.protocolFeeDenom;
}

function requirePool(
  poolsByToken: Record<string, IndexedPoolState>,
  tokenAddress: string,
  tokenIn: string,
  tokenOut: string,
): IndexedPoolState {
  const pool = poolsByToken[tokenAddress];

  if (!pool) {
    throw new MissingPoolContextError(tokenAddress, Object.keys(poolsByToken), tokenIn, tokenOut);
  }

  return pool;
}

export function isSwapAccountingError(error: unknown): error is SwapAccountingError {
  return error instanceof MissingPoolContextError || error instanceof RoutedSwapAccountingMismatchError;
}

export function describeSwapAccountingFailure(
  error: SwapAccountingError,
  context: SwapAccountingFailureContext,
): Record<string, string | number | string[]> {
  if (error instanceof MissingPoolContextError) {
    return {
      availablePools: error.availablePools,
      blockNumber: context.blockNumber.toString(),
      errorType: error.errorType,
      eventIndex: context.eventIndex,
      recoveryAction: "backfill_or_reindex_from_pool_creation",
      tokenAddress: error.tokenAddress,
      tokenIn: error.tokenIn,
      tokenOut: error.tokenOut,
      txHash: context.txHash,
    };
  }

  return {
    actualAmountOut: error.actualAmountOut.toString(),
    amountIn: error.amountIn.toString(),
    blockNumber: context.blockNumber.toString(),
    errorType: error.errorType,
    eventIndex: context.eventIndex,
    expectedAmountOut: error.expectedAmountOut.toString(),
    recoveryAction: "verify_lords_address_and_replay_from_safe_block",
    tokenIn: error.tokenIn,
    tokenOut: error.tokenOut,
    txHash: context.txHash,
  };
}
