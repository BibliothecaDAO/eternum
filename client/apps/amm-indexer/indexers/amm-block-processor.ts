import { decodeEvent, getSelector } from "@apibara/starknet";
import { and, eq } from "drizzle-orm";
import * as schema from "../src/schema";
import { ammAbi, EVENT_NAME } from "../src/abi";
import { buildSwapMutations, describeSwapAccountingFailure, isSwapAccountingError } from "./swap-accounting";

const MINIMUM_LIQUIDITY = 1000n;

/** Candle intervals in milliseconds. */
const CANDLE_INTERVALS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

const SELECTORS = {
  feeRecipientChanged: getSelector("FeeRecipientChanged"),
  liquidityAdded: getSelector("LiquidityAdded"),
  liquidityRemoved: getSelector("LiquidityRemoved"),
  poolCreated: getSelector("PoolCreated"),
  poolFeeChanged: getSelector("PoolFeeChanged"),
  swap: getSelector("Swap"),
};

interface ApplyAmmBlockParams {
  block: {
    events?: Array<any>;
    header?: {
      blockNumber?: bigint;
      timestamp?: Date;
    };
  };
  lordsAddress: string;
  txDb: any;
}

/**
 * Applies one streamed AMM block to the indexer database.
 * This is the testable core of the Apibara transform.
 */
export async function applyAmmBlockToDatabase(params: ApplyAmmBlockParams) {
  const blockNumber = params.block.header?.blockNumber ?? 0n;
  const blockTimestamp = params.block.header?.timestamp ?? new Date(0);
  const events = params.block.events ?? [];

  for (const event of events) {
    const txHash = event.transactionHash ?? "0x0";
    const eventIndex = event.eventIndex ?? 0;
    const eventSelector = event.keys?.[0];

    if (!eventSelector) {
      continue;
    }

    if (eventSelector === SELECTORS.poolCreated) {
      await recordPoolCreated(params.txDb, event, blockNumber, txHash);
      continue;
    }

    if (eventSelector === SELECTORS.swap) {
      await recordSwapEvent(params.txDb, event, {
        blockNumber,
        blockTimestamp,
        eventIndex,
        lordsAddress: params.lordsAddress,
        txHash,
      });
      continue;
    }

    if (eventSelector === SELECTORS.liquidityAdded) {
      await recordLiquidityAdded(params.txDb, event, {
        blockNumber,
        blockTimestamp,
        eventIndex,
        txHash,
      });
      continue;
    }

    if (eventSelector === SELECTORS.liquidityRemoved) {
      await recordLiquidityRemoved(params.txDb, event, {
        blockNumber,
        blockTimestamp,
        eventIndex,
        txHash,
      });
      continue;
    }

    if (eventSelector === SELECTORS.poolFeeChanged) {
      await recordPoolFeeChanged(params.txDb, event, {
        blockNumber,
        blockTimestamp,
        txHash,
      });
      continue;
    }

    if (eventSelector === SELECTORS.feeRecipientChanged) {
      const decoded = decodeEvent({
        abi: ammAbi,
        eventName: EVENT_NAME.FeeRecipientChanged,
        event,
      });

      console.log(`FeeRecipientChanged: ${decoded.args.old_recipient} -> ${decoded.args.new_recipient}`);
    }
  }
}

function getCandleOpenTime(timestamp: Date, intervalMs: number): Date {
  const ms = timestamp.getTime();
  return new Date(ms - (ms % intervalMs));
}

async function recordPoolCreated(txDb: any, event: any, blockNumber: bigint, txHash: string) {
  const decoded = decodeEvent({
    abi: ammAbi,
    eventName: EVENT_NAME.PoolCreated,
    event,
  });

  await txDb.insert(schema.pools).values({
    tokenAddress: String(decoded.args.token),
    lpTokenAddress: String(decoded.args.lp_token),
    lordsReserve: "0",
    tokenReserve: "0",
    totalLpSupply: "0",
    lpFeeNum: decoded.args.lp_fee_num.toString(),
    lpFeeDenom: decoded.args.lp_fee_denom.toString(),
    protocolFeeNum: decoded.args.protocol_fee_num.toString(),
    protocolFeeDenom: decoded.args.protocol_fee_denom.toString(),
    blockNumber,
    txHash,
  });
}

async function recordSwapEvent(
  txDb: any,
  event: any,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
    eventIndex: number;
    lordsAddress: string;
    txHash: string;
  },
) {
  const decoded = decodeEvent({
    abi: ammAbi,
    eventName: EVENT_NAME.Swap,
    event,
  });

  const user = String(decoded.args.user);
  const tokenIn = String(decoded.args.token_in);
  const tokenOut = String(decoded.args.token_out);
  const amountIn = BigInt(decoded.args.amount_in.toString());
  const amountOut = BigInt(decoded.args.amount_out.toString());
  const protocolFee = BigInt(decoded.args.protocol_fee.toString());
  const touchedPoolAddresses = Array.from(
    new Set([tokenIn, tokenOut].filter((address) => address.toLowerCase() !== context.lordsAddress.toLowerCase())),
  );
  const poolsByTokenEntries = await Promise.all(
    touchedPoolAddresses.map(async (tokenAddress) => {
      const rows = await txDb.select().from(schema.pools).where(eq(schema.pools.tokenAddress, tokenAddress)).limit(1);
      const pool = rows[0];

      if (!pool) {
        return [tokenAddress, null] as const;
      }

      return [
        tokenAddress,
        {
          tokenAddress,
          lordsReserve: BigInt(pool.lordsReserve),
          tokenReserve: BigInt(pool.tokenReserve),
          feeNum: BigInt(pool.lpFeeNum),
          feeDenom: BigInt(pool.lpFeeDenom),
          protocolFeeNum: BigInt(pool.protocolFeeNum),
          protocolFeeDenom: BigInt(pool.protocolFeeDenom),
        },
      ] as const;
    }),
  );
  const poolsByToken = Object.fromEntries(
    poolsByTokenEntries.filter(
      (entry): entry is readonly [string, NonNullable<(typeof entry)[1]>] => entry[1] !== null,
    ),
  );
  let mutations;

  try {
    mutations = buildSwapMutations({
      lordsAddress: context.lordsAddress,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      protocolFee,
      poolsByToken,
    });
  } catch (error) {
    if (isSwapAccountingError(error)) {
      console.error(
        JSON.stringify(
          describeSwapAccountingFailure(error, {
            blockNumber: context.blockNumber,
            eventIndex: context.eventIndex,
            txHash: context.txHash,
          }),
        ),
      );
    }
    throw error;
  }

  for (const mutation of mutations) {
    await txDb
      .update(schema.pools)
      .set({
        lordsReserve: mutation.nextLordsReserve.toString(),
        tokenReserve: mutation.nextTokenReserve.toString(),
      })
      .where(eq(schema.pools.tokenAddress, mutation.tokenAddress));

    await txDb.insert(schema.swaps).values({
      tokenAddress: mutation.tokenAddress,
      userAddress: user,
      tokenIn: mutation.tokenIn,
      tokenOut: mutation.tokenOut,
      amountIn: mutation.amountIn.toString(),
      amountOut: mutation.amountOut.toString(),
      protocolFee: mutation.protocolFee.toString(),
      priceBeforeSwap: mutation.priceBeforeSwap,
      priceAfterSwap: mutation.priceAfterSwap,
      blockNumber: context.blockNumber,
      blockTimestamp: context.blockTimestamp,
      txHash: context.txHash,
      eventIndex: context.eventIndex,
    });

    await upsertSwapCandles(txDb, mutation, context.blockTimestamp);
  }
}

async function upsertSwapCandles(txDb: any, mutation: any, blockTimestamp: Date) {
  for (const [interval, intervalMs] of Object.entries(CANDLE_INTERVALS)) {
    const openTime = getCandleOpenTime(blockTimestamp, intervalMs);
    const closeTime = new Date(openTime.getTime() + intervalMs);
    const existingCandle = await txDb
      .select()
      .from(schema.priceCandles)
      .where(
        and(
          eq(schema.priceCandles.tokenAddress, mutation.tokenAddress),
          eq(schema.priceCandles.interval, interval),
          eq(schema.priceCandles.openTime, openTime),
        ),
      )
      .limit(1);

    if (existingCandle.length > 0) {
      const candle = existingCandle[0];
      const currentHigh = parseFloat(candle.high);
      const currentLow = parseFloat(candle.low);
      const swapPrice = parseFloat(mutation.priceAfterSwap);

      await txDb
        .update(schema.priceCandles)
        .set({
          high: Math.max(currentHigh, swapPrice).toString(),
          low: Math.min(currentLow, swapPrice).toString(),
          close: mutation.priceAfterSwap,
          volume: (BigInt(candle.volume) + mutation.amountIn).toString(),
          tradeCount: candle.tradeCount + 1,
        })
        .where(eq(schema.priceCandles.id, candle.id));
    } else {
      await txDb.insert(schema.priceCandles).values({
        tokenAddress: mutation.tokenAddress,
        interval,
        openTime,
        closeTime,
        open: mutation.priceBeforeSwap,
        high:
          parseFloat(mutation.priceAfterSwap) > parseFloat(mutation.priceBeforeSwap)
            ? mutation.priceAfterSwap
            : mutation.priceBeforeSwap,
        low:
          parseFloat(mutation.priceAfterSwap) < parseFloat(mutation.priceBeforeSwap)
            ? mutation.priceAfterSwap
            : mutation.priceBeforeSwap,
        close: mutation.priceAfterSwap,
        volume: mutation.amountIn.toString(),
        tradeCount: 1,
      });
    }
  }
}

async function recordLiquidityAdded(
  txDb: any,
  event: any,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
    eventIndex: number;
    txHash: string;
  },
) {
  const decoded = decodeEvent({
    abi: ammAbi,
    eventName: EVENT_NAME.LiquidityAdded,
    event,
  });

  const token = String(decoded.args.token);
  const provider = String(decoded.args.provider);
  const lordsAmount = BigInt(decoded.args.lords_amount.toString());
  const tokenAmount = BigInt(decoded.args.token_amount.toString());
  const lpMinted = BigInt(decoded.args.lp_minted.toString());
  const poolRows = await txDb.select().from(schema.pools).where(eq(schema.pools.tokenAddress, token)).limit(1);
  const pool = poolRows[0];

  if (!pool) {
    throw new Error(`pool ${token} must exist before liquidity is indexed`);
  }

  const currentTotalSupply = BigInt(pool.totalLpSupply);
  const supplyIncrease = currentTotalSupply === 0n ? lpMinted + MINIMUM_LIQUIDITY : lpMinted;
  const nextLordsReserve = BigInt(pool.lordsReserve) + lordsAmount;
  const nextTokenReserve = BigInt(pool.tokenReserve) + tokenAmount;
  const nextTotalSupply = currentTotalSupply + supplyIncrease;

  await txDb.insert(schema.liquidityEvents).values({
    tokenAddress: token,
    providerAddress: provider,
    eventType: "add",
    lordsAmount: lordsAmount.toString(),
    tokenAmount: tokenAmount.toString(),
    lpAmount: lpMinted.toString(),
    blockNumber: context.blockNumber,
    blockTimestamp: context.blockTimestamp,
    txHash: context.txHash,
    eventIndex: context.eventIndex,
  });

  await txDb
    .update(schema.pools)
    .set({
      lordsReserve: nextLordsReserve.toString(),
      tokenReserve: nextTokenReserve.toString(),
      totalLpSupply: nextTotalSupply.toString(),
    })
    .where(eq(schema.pools.tokenAddress, token));
}

async function recordLiquidityRemoved(
  txDb: any,
  event: any,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
    eventIndex: number;
    txHash: string;
  },
) {
  const decoded = decodeEvent({
    abi: ammAbi,
    eventName: EVENT_NAME.LiquidityRemoved,
    event,
  });

  const token = String(decoded.args.token);
  const provider = String(decoded.args.provider);
  const lordsAmount = BigInt(decoded.args.lords_amount.toString());
  const tokenAmount = BigInt(decoded.args.token_amount.toString());
  const lpBurned = BigInt(decoded.args.lp_burned.toString());
  const poolRows = await txDb.select().from(schema.pools).where(eq(schema.pools.tokenAddress, token)).limit(1);
  const pool = poolRows[0];

  if (!pool) {
    throw new Error(`pool ${token} must exist before liquidity removal is indexed`);
  }

  const nextLordsReserve = BigInt(pool.lordsReserve) - lordsAmount;
  const nextTokenReserve = BigInt(pool.tokenReserve) - tokenAmount;
  const nextTotalSupply = BigInt(pool.totalLpSupply) - lpBurned;

  await txDb.insert(schema.liquidityEvents).values({
    tokenAddress: token,
    providerAddress: provider,
    eventType: "remove",
    lordsAmount: lordsAmount.toString(),
    tokenAmount: tokenAmount.toString(),
    lpAmount: lpBurned.toString(),
    blockNumber: context.blockNumber,
    blockTimestamp: context.blockTimestamp,
    txHash: context.txHash,
    eventIndex: context.eventIndex,
  });

  await txDb
    .update(schema.pools)
    .set({
      lordsReserve: nextLordsReserve.toString(),
      tokenReserve: nextTokenReserve.toString(),
      totalLpSupply: nextTotalSupply.toString(),
    })
    .where(eq(schema.pools.tokenAddress, token));
}

async function recordPoolFeeChanged(
  txDb: any,
  event: any,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
    txHash: string;
  },
) {
  const decoded = decodeEvent({
    abi: ammAbi,
    eventName: EVENT_NAME.PoolFeeChanged,
    event,
  });

  const token = String(decoded.args.token);
  const lpFeeNum = decoded.args.lp_fee_num.toString();
  const lpFeeDenom = decoded.args.lp_fee_denom.toString();
  const protocolFeeNum = decoded.args.protocol_fee_num.toString();
  const protocolFeeDenom = decoded.args.protocol_fee_denom.toString();

  await txDb.insert(schema.poolFeeChanges).values({
    tokenAddress: token,
    lpFeeNum,
    lpFeeDenom,
    protocolFeeNum,
    protocolFeeDenom,
    blockNumber: context.blockNumber,
    blockTimestamp: context.blockTimestamp,
    txHash: context.txHash,
  });

  await txDb
    .update(schema.pools)
    .set({ lpFeeNum, lpFeeDenom, protocolFeeNum, protocolFeeDenom })
    .where(eq(schema.pools.tokenAddress, token));
}
