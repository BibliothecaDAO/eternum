import { AmmV2ApiClient } from "./api/client";
import type { PairSummary, PathQuote } from "./types";
import { quoteExactIn, quoteExactOut } from "./utils/math";
import { LiquidityTransactions } from "./transactions/liquidity";
import { SwapTransactions } from "./transactions/swap";

export interface AmmV2ClientConfig {
  indexerUrl: string;
}

export class AmmV2Client {
  readonly api: AmmV2ApiClient;
  readonly swap: SwapTransactions;
  readonly liquidity: LiquidityTransactions;

  constructor(config: AmmV2ClientConfig) {
    this.api = new AmmV2ApiClient(config.indexerUrl);
    this.swap = new SwapTransactions();
    this.liquidity = new LiquidityTransactions();
  }

  quoteExactIn(
    path: string[],
    amountIn: bigint,
    pairsByTokenPair: Record<string, PairSummary> | Map<string, PairSummary>,
  ): PathQuote {
    return quoteExactIn(path, amountIn, pairsByTokenPair);
  }

  quoteExactOut(
    path: string[],
    amountOut: bigint,
    pairsByTokenPair: Record<string, PairSummary> | Map<string, PairSummary>,
  ): PathQuote {
    return quoteExactOut(path, amountOut, pairsByTokenPair);
  }
}

export { AmmV2ApiClient } from "./api/client";
export type { PaginatedResponse } from "./api/client";
export { DEFAULT_DEADLINE_OFFSET, DEFAULT_SLIPPAGE_BPS, MINIMUM_LIQUIDITY } from "./constants";
export { LiquidityTransactions } from "./transactions/liquidity";
export type { AddLiquidityProps, RemoveLiquidityProps } from "./transactions/liquidity";
export { SwapTransactions } from "./transactions/swap";
export type {
  SwapExactTokensForTokensProps,
  SwapExactTokensForTokensWithApprovalProps,
  SwapTokensForExactTokensProps,
  SwapTokensForExactTokensWithApprovalProps,
} from "./transactions/swap";
export type {
  CandleInterval,
  PaginationOpts,
  PairLiquidityEvent,
  PairStats,
  PairSummary,
  PairSwapEvent,
  PathQuote,
  PriceCandle,
  TimeRangeOpts,
  UserPairPosition,
} from "./types";
export {
  DEFAULT_STANDALONE_AMMV2_INDEXER_URL,
  DEFAULT_STANDALONE_AMMV2_LORDS_ADDRESS,
  DEFAULT_STANDALONE_AMMV2_ROUTER_ADDRESS,
  STANDALONE_AMM_RESOURCES,
  resolveStandaloneAmmTokenName,
} from "./standalone";
export type { StandaloneAmmResource } from "./standalone";
export { formatTokenAmount, parseTokenAmount } from "./utils/format";
export { computeAddLiquidity, computeInitialLpMint, computeLpBurn, computeLpMint, quote } from "./utils/liquidity";
export {
  DEFAULT_FEE_AMOUNT,
  THOUSAND,
  buildPairsByTokenPair,
  getAmountIn,
  getAmountOut,
  quoteExactIn,
  quoteExactOut,
  sortTokenPair,
  toPairKey,
} from "./utils/math";
export { computeMinimumReceived, computePriceImpact, computeSpotPrice } from "./utils/price";
