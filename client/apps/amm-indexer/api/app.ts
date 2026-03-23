import { getInputPrice } from "@bibliothecadao/amm-sdk";
import { Hono } from "hono";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import * as schema from "../src/schema";

interface PaginationParams {
  limit: number;
  offset: number;
}

interface CreateAmmApiAppParams {
  db: any;
  lordsAddress: string;
}

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      typeof currentValue === "bigint" ? currentValue.toString() : currentValue,
    ),
  ) as T;
}

function jsonResponse(c: { json: (body: unknown, status?: number) => Response }, body: unknown, status?: number) {
  return c.json(toJsonSafe(body), status);
}

function parsePagination(c: { req: { query: (k: string) => string | undefined } }): PaginationParams {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "50"), 1), 500);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);
  return { limit, offset };
}

function paginatedResponse<T>(data: T[], total: number, pagination: PaginationParams) {
  return {
    data,
    pagination: {
      total,
      limit: pagination.limit,
      offset: pagination.offset,
      hasMore: pagination.offset + pagination.limit < total,
    },
  };
}

export function createAmmApiApp(params: CreateAmmApiAppParams) {
  const app = new Hono();

  app.get("/api/v1/pools", async (c) => {
    const allPools = await params.db.select().from(schema.pools);
    return jsonResponse(c, { data: allPools });
  });

  app.get("/api/v1/pools/:tokenAddress", async (c) => {
    const tokenAddress = c.req.param("tokenAddress");
    const rows = await params.db
      .select()
      .from(schema.pools)
      .where(eq(schema.pools.tokenAddress, tokenAddress))
      .limit(1);

    if (rows.length === 0) {
      return jsonResponse(c, { error: "Pool not found" }, 404);
    }
    return jsonResponse(c, { data: rows[0] });
  });

  app.get("/api/v1/pools/:tokenAddress/swaps", async (c) => {
    const tokenAddress = c.req.param("tokenAddress");
    const pagination = parsePagination(c);

    const [totalResult, rows] = await Promise.all([
      params.db.select({ total: count() }).from(schema.swaps).where(eq(schema.swaps.tokenAddress, tokenAddress)),
      params.db
        .select()
        .from(schema.swaps)
        .where(eq(schema.swaps.tokenAddress, tokenAddress))
        .orderBy(desc(schema.swaps.blockTimestamp))
        .limit(pagination.limit)
        .offset(pagination.offset),
    ]);

    return jsonResponse(c, paginatedResponse(rows, totalResult[0].total, pagination));
  });

  app.get("/api/v1/pools/:tokenAddress/liquidity", async (c) => {
    const tokenAddress = c.req.param("tokenAddress");
    const pagination = parsePagination(c);

    const [totalResult, rows] = await Promise.all([
      params.db
        .select({ total: count() })
        .from(schema.liquidityEvents)
        .where(eq(schema.liquidityEvents.tokenAddress, tokenAddress)),
      params.db
        .select()
        .from(schema.liquidityEvents)
        .where(eq(schema.liquidityEvents.tokenAddress, tokenAddress))
        .orderBy(desc(schema.liquidityEvents.blockTimestamp))
        .limit(pagination.limit)
        .offset(pagination.offset),
    ]);

    return jsonResponse(c, paginatedResponse(rows, totalResult[0].total, pagination));
  });

  app.get("/api/v1/pools/:tokenAddress/candles", async (c) => {
    const tokenAddress = c.req.param("tokenAddress");
    const interval = c.req.query("interval") ?? "1h";
    const from = c.req.query("from");
    const to = c.req.query("to");

    const conditions = [eq(schema.priceCandles.tokenAddress, tokenAddress), eq(schema.priceCandles.interval, interval)];

    if (from) {
      conditions.push(gte(schema.priceCandles.openTime, new Date(from)));
    }
    if (to) {
      conditions.push(lte(schema.priceCandles.openTime, new Date(to)));
    }

    const rows = await params.db
      .select()
      .from(schema.priceCandles)
      .where(and(...conditions))
      .orderBy(schema.priceCandles.openTime)
      .limit(1000);

    return jsonResponse(c, { data: rows });
  });

  app.get("/api/v1/pools/:tokenAddress/stats", async (c) => {
    const tokenAddress = c.req.param("tokenAddress");
    const poolRows = await params.db
      .select()
      .from(schema.pools)
      .where(eq(schema.pools.tokenAddress, tokenAddress))
      .limit(1);

    if (poolRows.length === 0) {
      return jsonResponse(c, { error: "Pool not found" }, 404);
    }

    const poolData = poolRows[0];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86_400_000);

    const volumeResult = await params.db
      .select({
        totalVolume: sql<string>`COALESCE(SUM(${schema.swaps.amountIn}::numeric), 0)::text`,
        totalFees: sql<string>`COALESCE(SUM(${schema.swaps.protocolFee}::numeric), 0)::text`,
        tradeCount: count(),
      })
      .from(schema.swaps)
      .where(and(eq(schema.swaps.tokenAddress, tokenAddress), gte(schema.swaps.blockTimestamp, oneDayAgo)));

    const volume24h = volumeResult[0]?.totalVolume ?? "0";
    const fees24h = volumeResult[0]?.totalFees ?? "0";
    const trades24h = volumeResult[0]?.tradeCount ?? 0;
    const lordsReserve = BigInt(poolData.lordsReserve);
    const tvl = (lordsReserve * 2n).toString();

    let apr = "0";
    if (lordsReserve > 0n) {
      const fees = BigInt(fees24h);
      if (fees > 0n) {
        const aprBps = (fees * 365n * 10000n) / BigInt(tvl);
        apr = (Number(aprBps) / 100).toFixed(2);
      }
    }

    return jsonResponse(c, {
      data: {
        tokenAddress,
        lordsReserve: poolData.lordsReserve,
        tokenReserve: poolData.tokenReserve,
        totalLpSupply: poolData.totalLpSupply,
        tvl,
        volume24h,
        fees24h,
        trades24h,
        apr: `${apr}%`,
      },
    });
  });

  app.get("/api/v1/users/:address/positions", async (c) => {
    const address = c.req.param("address");

    const positions = await params.db
      .select({
        tokenAddress: schema.liquidityEvents.tokenAddress,
        totalLordsAdded: sql<string>`COALESCE(SUM(CASE WHEN ${schema.liquidityEvents.eventType} = 'add' THEN ${schema.liquidityEvents.lordsAmount}::numeric ELSE 0 END), 0)::text`,
        totalLordsRemoved: sql<string>`COALESCE(SUM(CASE WHEN ${schema.liquidityEvents.eventType} = 'remove' THEN ${schema.liquidityEvents.lordsAmount}::numeric ELSE 0 END), 0)::text`,
        totalTokenAdded: sql<string>`COALESCE(SUM(CASE WHEN ${schema.liquidityEvents.eventType} = 'add' THEN ${schema.liquidityEvents.tokenAmount}::numeric ELSE 0 END), 0)::text`,
        totalTokenRemoved: sql<string>`COALESCE(SUM(CASE WHEN ${schema.liquidityEvents.eventType} = 'remove' THEN ${schema.liquidityEvents.tokenAmount}::numeric ELSE 0 END), 0)::text`,
        totalLpMinted: sql<string>`COALESCE(SUM(CASE WHEN ${schema.liquidityEvents.eventType} = 'add' THEN ${schema.liquidityEvents.lpAmount}::numeric ELSE 0 END), 0)::text`,
        totalLpBurned: sql<string>`COALESCE(SUM(CASE WHEN ${schema.liquidityEvents.eventType} = 'remove' THEN ${schema.liquidityEvents.lpAmount}::numeric ELSE 0 END), 0)::text`,
      })
      .from(schema.liquidityEvents)
      .where(eq(schema.liquidityEvents.providerAddress, address))
      .groupBy(schema.liquidityEvents.tokenAddress);

    const result = (
      await Promise.all(
        positions.map(async (pos) => {
          const lpBalance = BigInt(pos.totalLpMinted) - BigInt(pos.totalLpBurned);

          if (lpBalance <= 0n) {
            return null;
          }

          const poolRows = await params.db
            .select()
            .from(schema.pools)
            .where(eq(schema.pools.tokenAddress, pos.tokenAddress))
            .limit(1);
          const pool = poolRows[0];

          if (!pool) {
            return null;
          }

          const totalLpSupply = BigInt(pool.totalLpSupply);
          const lordsReserve = BigInt(pool.lordsReserve);
          const tokenReserve = BigInt(pool.tokenReserve);
          const lordsValue = totalLpSupply > 0n ? (lordsReserve * lpBalance) / totalLpSupply : 0n;
          const tokenValue = totalLpSupply > 0n ? (tokenReserve * lpBalance) / totalLpSupply : 0n;
          const poolShare = totalLpSupply > 0n ? Number((lpBalance * 10000n) / totalLpSupply) / 100 : 0;

          return {
            tokenAddress: pos.tokenAddress,
            lpBalance: lpBalance.toString(),
            poolShare,
            lordsValue: lordsValue.toString(),
            tokenValue: tokenValue.toString(),
          };
        }),
      )
    ).filter((position): position is NonNullable<typeof position> => position !== null);

    return jsonResponse(c, { data: result });
  });

  app.get("/api/v1/quote", async (c) => {
    const tokenIn = c.req.query("tokenIn");
    const tokenOut = c.req.query("tokenOut");
    const amountInStr = c.req.query("amountIn");

    if (!tokenIn || !tokenOut || !amountInStr) {
      return jsonResponse(c, { error: "Missing required params: tokenIn, tokenOut, amountIn" }, 400);
    }

    const amountIn = BigInt(amountInStr);
    const isLordsInput = tokenIn.toLowerCase() === params.lordsAddress.toLowerCase();
    const isLordsOutput = tokenOut.toLowerCase() === params.lordsAddress.toLowerCase();

    if (isLordsInput || isLordsOutput) {
      const poolToken = isLordsInput ? tokenOut : tokenIn;
      const poolRows = await params.db
        .select()
        .from(schema.pools)
        .where(eq(schema.pools.tokenAddress, poolToken))
        .limit(1);

      if (poolRows.length === 0) {
        return jsonResponse(c, { error: "Pool not found" }, 404);
      }

      const poolData = poolRows[0];
      const lordsReserve = BigInt(poolData.lordsReserve);
      const tokenReserve = BigInt(poolData.tokenReserve);
      const feeNum = BigInt(poolData.lpFeeNum);
      const feeDenom = BigInt(poolData.lpFeeDenom);

      let amountOut: bigint;
      if (isLordsInput) {
        amountOut = getInputPrice(feeNum, feeDenom, amountIn, lordsReserve, tokenReserve);
      } else {
        amountOut = getInputPrice(feeNum, feeDenom, amountIn, tokenReserve, lordsReserve);
      }

      const protocolFeeNum = BigInt(poolData.protocolFeeNum);
      const protocolFeeDenom = BigInt(poolData.protocolFeeDenom);
      let protocolFee = 0n;
      if (protocolFeeNum > 0n && protocolFeeDenom > 0n) {
        protocolFee = (amountOut * protocolFeeNum) / protocolFeeDenom;
      }
      const netAmountOut = amountOut - protocolFee;

      let priceImpact = "0";
      if (amountIn > 0n && netAmountOut > 0n) {
        const spotPrice = isLordsInput
          ? (tokenReserve * 10n ** 18n) / lordsReserve
          : (lordsReserve * 10n ** 18n) / tokenReserve;
        const actualPrice = (netAmountOut * 10n ** 18n) / amountIn;
        if (spotPrice > 0n) {
          const impactBps =
            spotPrice > actualPrice
              ? ((spotPrice - actualPrice) * 10000n) / spotPrice
              : ((actualPrice - spotPrice) * 10000n) / spotPrice;
          priceImpact = (Number(impactBps) / 100).toFixed(2);
        }
      }

      return jsonResponse(c, {
        data: {
          amountIn: amountIn.toString(),
          amountOut: netAmountOut.toString(),
          protocolFee: protocolFee.toString(),
          priceImpact: `${priceImpact}%`,
          route: [poolToken],
        },
      });
    }

    return jsonResponse(c, { error: "Token-to-token quote not yet supported by /api/v1/quote" }, 400);
  });

  return app;
}
