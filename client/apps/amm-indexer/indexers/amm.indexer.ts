import { defineIndexer } from "apibara/indexer";
import { StarknetStream, getSelector, decodeEvent } from "@apibara/starknet";
import { drizzleStorage, useDrizzleStorage, drizzle } from "@apibara/plugin-drizzle";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "../src/schema";
import { ammAbi, EVENT_NAME } from "../src/abi";
import { buildSwapMutations, describeSwapAccountingFailure, isSwapAccountingError } from "./swap-accounting";
import { resolveIndexerRuntimeConfig } from "./runtime-config";

/** LORDS token address — used to determine which pool a swap belongs to */
const runtimeConfig = resolveIndexerRuntimeConfig({
  ammAddress: process.env.AMM_ADDRESS ?? "",
  lordsAddress: process.env.LORDS_ADDRESS ?? "",
});
const LORDS_ADDRESS = runtimeConfig.lordsAddress;

/** Candle intervals in milliseconds */
const CANDLE_INTERVALS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

/**
 * Get the candle open time for a given timestamp and interval.
 */
function getCandleOpenTime(timestamp: Date, intervalMs: number): Date {
  const ms = timestamp.getTime();
  const aligned = ms - (ms % intervalMs);
  return new Date(aligned);
}

const ammAddress = runtimeConfig.ammAddress as `0x${string}`;

const db = drizzle({
  type: "node-postgres",
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  schema,
});

export default defineIndexer(StarknetStream)({
  streamUrl: process.env.STREAM_URL ?? "https://mainnet.starknet.a5a.ch",
  startingBlock: BigInt(process.env.STARTING_BLOCK ?? "0"),
  plugins: [drizzleStorage({ db })],
  filter: {
    events: [
      {
        address: ammAddress,
        keys: [getSelector(EVENT_NAME.PoolCreated)],
      },
      {
        address: ammAddress,
        keys: [getSelector(EVENT_NAME.LiquidityAdded)],
      },
      {
        address: ammAddress,
        keys: [getSelector(EVENT_NAME.LiquidityRemoved)],
      },
      {
        address: ammAddress,
        keys: [getSelector(EVENT_NAME.Swap)],
      },
      {
        address: ammAddress,
        keys: [getSelector(EVENT_NAME.PoolFeeChanged)],
      },
      {
        address: ammAddress,
        keys: [getSelector(EVENT_NAME.FeeRecipientChanged)],
      },
    ],
  },
  async transform({ block }) {
    const { db: txDb } = useDrizzleStorage();
    const blockNumber = block.header?.blockNumber ?? 0n;
    const blockTimestamp = block.header?.timestamp ?? new Date(0);
    const events = block.events ?? [];

    for (const event of events) {
      const txHash = event.transactionHash ?? "0x0";
      const eventIndex = event.eventIndex ?? 0;
      const eventSelector = event.keys?.[0];

      if (!eventSelector) continue;

      const poolCreatedSelector = getSelector(EVENT_NAME.PoolCreated);
      const swapSelector = getSelector(EVENT_NAME.Swap);
      const liquidityAddedSelector = getSelector(EVENT_NAME.LiquidityAdded);
      const liquidityRemovedSelector = getSelector(EVENT_NAME.LiquidityRemoved);
      const poolFeeChangedSelector = getSelector(EVENT_NAME.PoolFeeChanged);
      const feeRecipientChangedSelector = getSelector(EVENT_NAME.FeeRecipientChanged);

      // PoolCreated
      if (eventSelector === poolCreatedSelector) {
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

      // Swap
      else if (eventSelector === swapSelector) {
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
          new Set([tokenIn, tokenOut].filter((address) => address.toLowerCase() !== LORDS_ADDRESS.toLowerCase())),
        );
        const poolsByTokenEntries = await Promise.all(
          touchedPoolAddresses.map(async (tokenAddress) => {
            const rows = await txDb
              .select()
              .from(schema.pools)
              .where(eq(schema.pools.tokenAddress, tokenAddress))
              .limit(1);
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
            lordsAddress: LORDS_ADDRESS,
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
                  blockNumber,
                  eventIndex,
                  txHash,
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
            blockNumber,
            blockTimestamp,
            txHash,
            eventIndex,
          });

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
      }

      // LiquidityAdded
      else if (eventSelector === liquidityAddedSelector) {
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

        await txDb.insert(schema.liquidityEvents).values({
          tokenAddress: token,
          providerAddress: provider,
          eventType: "add",
          lordsAmount: lordsAmount.toString(),
          tokenAmount: tokenAmount.toString(),
          lpAmount: lpMinted.toString(),
          blockNumber,
          blockTimestamp,
          txHash,
          eventIndex,
        });

        await txDb
          .update(schema.pools)
          .set({
            lordsReserve: sql`(${schema.pools.lordsReserve}::numeric + ${lordsAmount.toString()}::numeric)::text`,
            tokenReserve: sql`(${schema.pools.tokenReserve}::numeric + ${tokenAmount.toString()}::numeric)::text`,
            totalLpSupply: sql`(${schema.pools.totalLpSupply}::numeric + ${lpMinted.toString()}::numeric)::text`,
          })
          .where(eq(schema.pools.tokenAddress, token));
      }

      // LiquidityRemoved
      else if (eventSelector === liquidityRemovedSelector) {
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

        await txDb.insert(schema.liquidityEvents).values({
          tokenAddress: token,
          providerAddress: provider,
          eventType: "remove",
          lordsAmount: lordsAmount.toString(),
          tokenAmount: tokenAmount.toString(),
          lpAmount: lpBurned.toString(),
          blockNumber,
          blockTimestamp,
          txHash,
          eventIndex,
        });

        await txDb
          .update(schema.pools)
          .set({
            lordsReserve: sql`(${schema.pools.lordsReserve}::numeric - ${lordsAmount.toString()}::numeric)::text`,
            tokenReserve: sql`(${schema.pools.tokenReserve}::numeric - ${tokenAmount.toString()}::numeric)::text`,
            totalLpSupply: sql`(${schema.pools.totalLpSupply}::numeric - ${lpBurned.toString()}::numeric)::text`,
          })
          .where(eq(schema.pools.tokenAddress, token));
      }

      // PoolFeeChanged
      else if (eventSelector === poolFeeChangedSelector) {
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
          blockNumber,
          blockTimestamp,
          txHash,
        });

        await txDb
          .update(schema.pools)
          .set({ lpFeeNum, lpFeeDenom, protocolFeeNum, protocolFeeDenom })
          .where(eq(schema.pools.tokenAddress, token));
      }

      // FeeRecipientChanged — log only
      else if (eventSelector === feeRecipientChangedSelector) {
        const decoded = decodeEvent({
          abi: ammAbi,
          eventName: EVENT_NAME.FeeRecipientChanged,
          event,
        });

        console.log(`FeeRecipientChanged: ${decoded.args.old_recipient} -> ${decoded.args.new_recipient}`);
      }
    }
  },
});
