import type { Account, Call } from "starknet";
import { AmmApiClient } from "./api/client";
import { DEFAULT_SLIPPAGE_BPS } from "./constants";
import { AdminTransactions } from "./transactions/admin";
import { LiquidityTransactions } from "./transactions/liquidity";
import { SwapTransactions } from "./transactions/swap";
import type { Pool, SwapQuote } from "./types";
import { getInputPrice } from "./utils/math";
import { computeMinimumReceived, computePriceImpact, computeSpotPrice } from "./utils/price";

export interface AmmClientConfig {
  /** AMM contract address on Starknet. */
  ammAddress: string;
  /** LORDS token contract address. */
  lordsAddress: string;
  /** Base URL for the AMM indexer API. */
  indexerUrl: string;
}

/**
 * Top-level AMM client that composes the API client, transaction builders,
 * and utility functions into a single ergonomic interface.
 */
export class AmmClient {
  readonly api: AmmApiClient;
  readonly swap: SwapTransactions;
  readonly liquidity: LiquidityTransactions;
  readonly admin: AdminTransactions;

  readonly ammAddress: string;
  readonly lordsAddress: string;

  constructor(config: AmmClientConfig) {
    this.ammAddress = config.ammAddress;
    this.lordsAddress = config.lordsAddress;
    this.api = new AmmApiClient(config.indexerUrl);
    this.swap = new SwapTransactions();
    this.liquidity = new LiquidityTransactions();
    this.admin = new AdminTransactions();
  }

  /**
   * Execute one or more Calls using the provided account.
   * Returns the transaction hash.
   */
  async execute(account: Account, calls: Call | Call[]): Promise<string> {
    const callArray = Array.isArray(calls) ? calls : [calls];
    const result = await account.execute(callArray);
    return result.transaction_hash;
  }

  /**
   * Compute a swap quote for a given pool and input amount.
   * @param pool The pool to swap in.
   * @param amountIn The input amount.
   * @param isLordsInput Whether the input is LORDS (true) or token (false).
   * @param slippageBps Slippage tolerance in basis points (default 50 = 0.5%).
   */
  quoteSwap(
    pool: Pool,
    amountIn: bigint,
    isLordsInput: boolean,
    slippageBps: bigint = DEFAULT_SLIPPAGE_BPS,
  ): SwapQuote {
    const [inputReserve, outputReserve] = isLordsInput
      ? [pool.lordsReserve, pool.tokenReserve]
      : [pool.tokenReserve, pool.lordsReserve];

    const grossAmountOut = getInputPrice(pool.feeNum, pool.feeDenom, amountIn, inputReserve, outputReserve);
    const protocolFee =
      pool.protocolFeeNum > 0n && pool.protocolFeeDenom > 0n
        ? (grossAmountOut * pool.protocolFeeNum) / pool.protocolFeeDenom
        : 0n;
    const amountOut = grossAmountOut - protocolFee;

    const priceImpact = computePriceImpact(amountIn, inputReserve, outputReserve, pool.feeNum, pool.feeDenom);

    const minimumReceived = computeMinimumReceived(amountOut, slippageBps);

    const spotPriceBefore = isLordsInput
      ? computeSpotPrice(pool.lordsReserve, pool.tokenReserve)
      : computeSpotPrice(pool.tokenReserve, pool.lordsReserve);

    // Compute post-swap reserves
    const newInputReserve = inputReserve + amountIn;
    const newOutputReserve = outputReserve - grossAmountOut;
    const spotPriceAfter = isLordsInput
      ? Number(newInputReserve) / Number(newOutputReserve)
      : Number(newOutputReserve) / Number(newInputReserve);

    return {
      amountOut,
      priceImpact,
      minimumReceived,
      spotPriceBefore,
      spotPriceAfter,
    };
  }
}

// Re-export everything
export { AmmApiClient } from "./api/client";
export type { PaginatedResponse } from "./api/client";
export { MAINNET, SEPOLIA, DEFAULT_SLIPPAGE_BPS, DEFAULT_DEADLINE_OFFSET } from "./constants";
export type { NetworkConfig } from "./constants";
export { AdminTransactions } from "./transactions/admin";
export type { CreatePoolProps, SetPoolFeeProps, SetFeeRecipientProps, SetPausedProps } from "./transactions/admin";
export { LiquidityTransactions } from "./transactions/liquidity";
export type { AddLiquidityProps, AddLiquidityWithApprovalProps, RemoveLiquidityProps } from "./transactions/liquidity";
export { SwapTransactions } from "./transactions/swap";
export type {
  SwapLordsForTokenProps,
  SwapTokenForLordsProps,
  SwapTokenForTokenProps,
  SwapWithApprovalProps,
  SwapTokenForLordsWithApprovalProps,
  SwapTokenForTokenWithApprovalProps,
} from "./transactions/swap";
export type {
  Pool,
  SwapEvent,
  LiquidityEvent,
  PriceCandle,
  PoolStats,
  SwapQuote,
  UserPosition,
  PaginationOpts,
  TimeRangeOpts,
  CandleInterval,
} from "./types";
export { formatTokenAmount, parseTokenAmount } from "./utils/format";
export { getInputPrice, getOutputPrice, quote, computeAddLiquidity, computeLpMint, computeLpBurn } from "./utils/math";
export { computePriceImpact, computeMinimumReceived, computeSpotPrice } from "./utils/price";
