import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";
import pg from "pg";
import * as schema from "../src/schema";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});

const db = drizzle(pool, { schema });

const app = new Hono();

// ============ Helpers ============

interface PaginationParams {
  limit: number;
  offset: number;
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

/**
 * Constant-product swap quote (port of Cairo math::get_input_price).
 * output = (input_after_fee * output_reserve) / (input_reserve + input_after_fee)
 */
function getInputPrice(
  feeNum: bigint,
  feeDenom: bigint,
  inputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
): bigint {
  if (inputReserve <= 0n || outputReserve <= 0n) return 0n;
  if (inputAmount <= 0n) return 0n;

  const inputAfterFee = (inputAmount * (feeDenom - feeNum)) / feeDenom;
  const numerator = inputAfterFee * outputReserve;
  const denominator = inputReserve + inputAfterFee;

  return numerator / denominator;
}

// ============ Routes ============

// GET /api/v1/pools — all pools
app.get("/api/v1/pools", async (c) => {
  const allPools = await db.select().from(schema.pools);
  return c.json({ data: allPools });
});

// GET /api/v1/pools/:tokenAddress — single pool
app.get("/api/v1/pools/:tokenAddress", async (c) => {
  const tokenAddress = c.req.param("tokenAddress");
  const rows = await db
    .select()
    .from(schema.pools)
    .where(eq(schema.pools.tokenAddress, tokenAddress))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: "Pool not found" }, 404);
  }
  return c.json({ data: rows[0] });
});

// GET /api/v1/pools/:tokenAddress/swaps — swap history
app.get("/api/v1/pools/:tokenAddress/swaps", async (c) => {
  const tokenAddress = c.req.param("tokenAddress");
  const pagination = parsePagination(c);

  const [totalResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.swaps)
      .where(eq(schema.swaps.tokenAddress, tokenAddress)),
    db
      .select()
      .from(schema.swaps)
      .where(eq(schema.swaps.tokenAddress, tokenAddress))
      .orderBy(desc(schema.swaps.blockTimestamp))
      .limit(pagination.limit)
      .offset(pagination.offset),
  ]);

  return c.json(paginatedResponse(rows, totalResult[0].total, pagination));
});

// GET /api/v1/pools/:tokenAddress/liquidity — liquidity events
app.get("/api/v1/pools/:tokenAddress/liquidity", async (c) => {
  const tokenAddress = c.req.param("tokenAddress");
  const pagination = parsePagination(c);

  const [totalResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.liquidityEvents)
      .where(eq(schema.liquidityEvents.tokenAddress, tokenAddress)),
    db
      .select()
      .from(schema.liquidityEvents)
      .where(eq(schema.liquidityEvents.tokenAddress, tokenAddress))
      .orderBy(desc(schema.liquidityEvents.blockTimestamp))
      .limit(pagination.limit)
      .offset(pagination.offset),
  ]);

  return c.json(paginatedResponse(rows, totalResult[0].total, pagination));
});

// GET /api/v1/pools/:tokenAddress/candles — OHLCV candles
app.get("/api/v1/pools/:tokenAddress/candles", async (c) => {
  const tokenAddress = c.req.param("tokenAddress");
  const interval = c.req.query("interval") ?? "1h";
  const from = c.req.query("from");
  const to = c.req.query("to");

  const conditions = [
    eq(schema.priceCandles.tokenAddress, tokenAddress),
    eq(schema.priceCandles.interval, interval),
  ];

  if (from) {
    conditions.push(gte(schema.priceCandles.openTime, new Date(from)));
  }
  if (to) {
    conditions.push(lte(schema.priceCandles.openTime, new Date(to)));
  }

  const rows = await db
    .select()
    .from(schema.priceCandles)
    .where(and(...conditions))
    .orderBy(schema.priceCandles.openTime)
    .limit(1000);

  return c.json({ data: rows });
});

// GET /api/v1/pools/:tokenAddress/stats — TVL, 24h volume, fees, APR
app.get("/api/v1/pools/:tokenAddress/stats", async (c) => {
  const tokenAddress = c.req.param("tokenAddress");

  // Get pool
  const poolRows = await db
    .select()
    .from(schema.pools)
    .where(eq(schema.pools.tokenAddress, tokenAddress))
    .limit(1);

  if (poolRows.length === 0) {
    return c.json({ error: "Pool not found" }, 404);
  }

  const poolData = poolRows[0];
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 86_400_000);

  // 24h volume and fees
  const volumeResult = await db
    .select({
      totalVolume: sql<string>`COALESCE(SUM(${schema.swaps.amountIn}::numeric), 0)::text`,
      totalFees: sql<string>`COALESCE(SUM(${schema.swaps.protocolFee}::numeric), 0)::text`,
      tradeCount: count(),
    })
    .from(schema.swaps)
    .where(
      and(
        eq(schema.swaps.tokenAddress, tokenAddress),
        gte(schema.swaps.blockTimestamp, oneDayAgo),
      ),
    );

  const volume24h = volumeResult[0]?.totalVolume ?? "0";
  const fees24h = volumeResult[0]?.totalFees ?? "0";
  const trades24h = volumeResult[0]?.tradeCount ?? 0;

  // TVL = lords_reserve * 2 (assuming lords is the quote token, so TVL in lords terms)
  const lordsReserve = BigInt(poolData.lordsReserve);
  const tvl = (lordsReserve * 2n).toString();

  // Annualized fee APR: (fees_24h / tvl) * 365
  let apr = "0";
  if (lordsReserve > 0n) {
    const fees = BigInt(fees24h);
    // APR = (fees * 365 * 10000) / tvl / 100 (as percentage)
    if (fees > 0n) {
      const aprBps = (fees * 365n * 10000n) / BigInt(tvl);
      apr = (Number(aprBps) / 100).toFixed(2);
    }
  }

  return c.json({
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

// GET /api/v1/users/:address/positions — LP positions across all pools
app.get("/api/v1/users/:address/positions", async (c) => {
  const address = c.req.param("address");

  // Aggregate liquidity events to compute net LP position per pool
  const positions = await db
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

  const result = positions.map((pos) => ({
    tokenAddress: pos.tokenAddress,
    netLpBalance: (BigInt(pos.totalLpMinted) - BigInt(pos.totalLpBurned)).toString(),
    totalLordsAdded: pos.totalLordsAdded,
    totalLordsRemoved: pos.totalLordsRemoved,
    totalTokenAdded: pos.totalTokenAdded,
    totalTokenRemoved: pos.totalTokenRemoved,
  }));

  return c.json({ data: result });
});

// GET /api/v1/quote — swap quote
app.get("/api/v1/quote", async (c) => {
  const tokenIn = c.req.query("tokenIn");
  const tokenOut = c.req.query("tokenOut");
  const amountInStr = c.req.query("amountIn");

  if (!tokenIn || !tokenOut || !amountInStr) {
    return c.json(
      { error: "Missing required params: tokenIn, tokenOut, amountIn" },
      400,
    );
  }

  const amountIn = BigInt(amountInStr);
  const lordsAddr = process.env.LORDS_ADDRESS ?? "";
  const isLordsInput = tokenIn.toLowerCase() === lordsAddr.toLowerCase();
  const isLordsOutput = tokenOut.toLowerCase() === lordsAddr.toLowerCase();

  // Direct swap: LORDS -> Token or Token -> LORDS
  if (isLordsInput || isLordsOutput) {
    const poolToken = isLordsInput ? tokenOut : tokenIn;
    const poolRows = await db
      .select()
      .from(schema.pools)
      .where(eq(schema.pools.tokenAddress, poolToken))
      .limit(1);

    if (poolRows.length === 0) {
      return c.json({ error: "Pool not found" }, 404);
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

    // Compute protocol fee on the output
    const protocolFeeNum = BigInt(poolData.protocolFeeNum);
    const protocolFeeDenom = BigInt(poolData.protocolFeeDenom);
    let protocolFee = 0n;
    if (protocolFeeNum > 0n && protocolFeeDenom > 0n) {
      protocolFee = (amountOut * protocolFeeNum) / protocolFeeDenom;
    }
    const netAmountOut = amountOut - protocolFee;

    // Price impact
    let priceImpact = "0";
    if (amountIn > 0n && netAmountOut > 0n) {
      const spotPrice = isLordsInput
        ? (tokenReserve * 10n ** 18n) / lordsReserve
        : (lordsReserve * 10n ** 18n) / tokenReserve;
      const executionPrice = (netAmountOut * 10n ** 18n) / amountIn;
      if (spotPrice > 0n) {
        const impact = ((spotPrice - executionPrice) * 10000n) / spotPrice;
        priceImpact = (Number(impact) / 100).toFixed(2);
      }
    }

    return c.json({
      data: {
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        amountOut: netAmountOut.toString(),
        protocolFee: protocolFee.toString(),
        priceImpact: `${priceImpact}%`,
      },
    });
  }

  // Token-to-token swap: Token A -> LORDS -> Token B
  const poolARows = await db
    .select()
    .from(schema.pools)
    .where(eq(schema.pools.tokenAddress, tokenIn))
    .limit(1);
  const poolBRows = await db
    .select()
    .from(schema.pools)
    .where(eq(schema.pools.tokenAddress, tokenOut))
    .limit(1);

  if (poolARows.length === 0 || poolBRows.length === 0) {
    return c.json({ error: "One or both pools not found" }, 404);
  }

  const poolA = poolARows[0];
  const poolB = poolBRows[0];

  // First hop: tokenIn -> LORDS
  const lordsIntermediate = getInputPrice(
    BigInt(poolA.lpFeeNum),
    BigInt(poolA.lpFeeDenom),
    amountIn,
    BigInt(poolA.tokenReserve),
    BigInt(poolA.lordsReserve),
  );

  // Protocol fee on first hop
  let fee1 = 0n;
  if (BigInt(poolA.protocolFeeNum) > 0n && BigInt(poolA.protocolFeeDenom) > 0n) {
    fee1 = (lordsIntermediate * BigInt(poolA.protocolFeeNum)) / BigInt(poolA.protocolFeeDenom);
  }
  const netLords = lordsIntermediate - fee1;

  // Second hop: LORDS -> tokenOut
  const finalOut = getInputPrice(
    BigInt(poolB.lpFeeNum),
    BigInt(poolB.lpFeeDenom),
    netLords,
    BigInt(poolB.lordsReserve),
    BigInt(poolB.tokenReserve),
  );

  let fee2 = 0n;
  if (BigInt(poolB.protocolFeeNum) > 0n && BigInt(poolB.protocolFeeDenom) > 0n) {
    fee2 = (finalOut * BigInt(poolB.protocolFeeNum)) / BigInt(poolB.protocolFeeDenom);
  }
  const netFinalOut = finalOut - fee2;

  return c.json({
    data: {
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      amountOut: netFinalOut.toString(),
      lordsIntermediate: netLords.toString(),
      protocolFee: (fee1 + fee2).toString(),
      route: [tokenIn, lordsAddr, tokenOut],
    },
  });
});

// ============ Start server ============

const port = Number(process.env.API_PORT ?? "3000");

serve({
  fetch: app.fetch,
  port,
});

console.log(`AMM Indexer API running on http://localhost:${port}`);
