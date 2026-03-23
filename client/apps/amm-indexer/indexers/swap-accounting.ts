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

export function buildSwapMutations(params: BuildSwapMutationsParams): SwapMutation[] {
  if (params.tokenIn.toLowerCase() === params.lordsAddress.toLowerCase()) {
    const pool = requirePool(params.poolsByToken, params.tokenOut);
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
    const pool = requirePool(params.poolsByToken, params.tokenIn);
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

  const inputPool = requirePool(params.poolsByToken, params.tokenIn);
  const outputPool = requirePool(params.poolsByToken, params.tokenOut);

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
    throw new Error("routed swap output does not match derived pool math");
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

function requirePool(poolsByToken: Record<string, IndexedPoolState>, tokenAddress: string): IndexedPoolState {
  const pool = poolsByToken[tokenAddress];

  if (!pool) {
    throw new Error(`pool ${tokenAddress} is missing from swap accounting context`);
  }

  return pool;
}
