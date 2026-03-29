import { and, count, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { RpcProvider } from "starknet";
import * as schema from "../src/schema";

interface CreateAmmV2ApiAppParams {
  allowedOrigins?: string[];
  db: any;
  lordsAddress?: string;
  loadTokenTotalSupply?: LoadTokenTotalSupply;
  rpcUrl?: string;
}

interface PaginationParams {
  limit: number;
  offset: number;
}

type LoadTokenTotalSupply = (tokenAddress: string) => Promise<bigint | null>;

const ONE_DAY_IN_MS = 86_400_000;
const LOCAL_BROWSER_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
const FIRST_PARTY_BROWSER_DOMAIN = "realms.world";

export function createAmmV2ApiApp(params: CreateAmmV2ApiAppParams) {
  const app = new Hono();
  const allowedBrowserOrigins = buildAllowedBrowserOriginSet(params.allowedOrigins ?? []);
  const loadTokenTotalSupply = params.loadTokenTotalSupply ?? buildTokenTotalSupplyLoader(params.rpcUrl);
  const lordsAddress = normalizeOptionalAddress(params.lordsAddress);

  app.use(
    "/api/*",
    cors({
      origin: (origin: string) => (origin && isAllowedBrowserOrigin(origin, allowedBrowserOrigins) ? origin : ""),
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "OPTIONS"],
    }),
  );

  app.get("/api/v1/pairs", async (c: any) => {
    const token = normalizeOptionalAddress(c.req.query("token"));
    const pairRows = token
      ? await params.db
          .select()
          .from(schema.pairs)
          .where(or(eq(schema.pairs.token0Address, token), eq(schema.pairs.token1Address, token)))
      : await params.db.select().from(schema.pairs);

    return jsonResponse(c, { data: await buildPairSummaries(params.db, pairRows) });
  });

  app.get("/api/v1/pairs/lookup", async (c: any) => {
    const tokenA = normalizeOptionalAddress(c.req.query("tokenA"));
    const tokenB = normalizeOptionalAddress(c.req.query("tokenB"));

    if (!tokenA || !tokenB) {
      return jsonResponse(c, { error: "tokenA and tokenB are required" }, 400);
    }

    const rows = await params.db
      .select()
      .from(schema.pairs)
      .where(
        or(
          and(eq(schema.pairs.token0Address, tokenA), eq(schema.pairs.token1Address, tokenB)),
          and(eq(schema.pairs.token0Address, tokenB), eq(schema.pairs.token1Address, tokenA)),
        ),
      )
      .limit(1);
    const pair = rows[0];

    if (!pair) {
      return jsonResponse(c, { error: "Pair not found" }, 404);
    }

    return jsonResponse(c, { data: await buildPairSummary(params.db, pair) });
  });

  app.get("/api/v1/pairs/:pairAddress", async (c: any) => {
    const pair = await loadPairOrNull(params.db, c.req.param("pairAddress"));

    if (!pair) {
      return jsonResponse(c, { error: "Pair not found" }, 404);
    }

    return jsonResponse(c, { data: await buildPairSummary(params.db, pair) });
  });

  app.get("/api/v1/pairs/:pairAddress/swaps", async (c: any) => {
    const pairAddress = normalizeAddress(c.req.param("pairAddress"));
    const pagination = parsePagination(c);
    const conditions = buildTimeConditions(
      eq(schema.pairSwaps.pairAddress, pairAddress),
      c.req.query("from"),
      c.req.query("to"),
      schema.pairSwaps.blockTimestamp,
    );

    const [totalResult, rows] = await Promise.all([
      params.db
        .select({ total: count() })
        .from(schema.pairSwaps)
        .where(and(...conditions)),
      params.db
        .select()
        .from(schema.pairSwaps)
        .where(and(...conditions))
        .orderBy(desc(schema.pairSwaps.blockTimestamp))
        .limit(pagination.limit)
        .offset(pagination.offset),
    ]);

    return jsonResponse(c, paginatedResponse(rows, totalResult[0].total, pagination));
  });

  app.get("/api/v1/pairs/:pairAddress/liquidity", async (c: any) => {
    const pairAddress = normalizeAddress(c.req.param("pairAddress"));
    const pagination = parsePagination(c);
    const conditions = buildTimeConditions(
      eq(schema.pairLiquidityEvents.pairAddress, pairAddress),
      c.req.query("from"),
      c.req.query("to"),
      schema.pairLiquidityEvents.blockTimestamp,
    );

    const [totalResult, rows] = await Promise.all([
      params.db
        .select({ total: count() })
        .from(schema.pairLiquidityEvents)
        .where(and(...conditions)),
      params.db
        .select()
        .from(schema.pairLiquidityEvents)
        .where(and(...conditions))
        .orderBy(desc(schema.pairLiquidityEvents.blockTimestamp))
        .limit(pagination.limit)
        .offset(pagination.offset),
    ]);

    return jsonResponse(c, paginatedResponse(rows, totalResult[0].total, pagination));
  });

  app.get("/api/v1/pairs/:pairAddress/candles", async (c: any) => {
    const pairAddress = normalizeAddress(c.req.param("pairAddress"));
    const interval = c.req.query("interval") ?? "1h";
    const conditions = buildTimeConditions(
      and(eq(schema.pairPriceCandles.pairAddress, pairAddress), eq(schema.pairPriceCandles.interval, interval)),
      c.req.query("from"),
      c.req.query("to"),
      schema.pairPriceCandles.openTime,
    );

    const rows = await params.db
      .select()
      .from(schema.pairPriceCandles)
      .where(and(...conditions))
      .orderBy(schema.pairPriceCandles.openTime)
      .limit(1000);

    return jsonResponse(c, { data: rows });
  });

  app.get("/api/v1/pairs/:pairAddress/stats", async (c: any) => {
    const pair = await loadPairOrNull(params.db, c.req.param("pairAddress"));

    if (!pair) {
      return jsonResponse(c, { error: "Pair not found" }, 404);
    }

    const factory = await loadFactoryOrNull(params.db, pair.factoryAddress);
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - ONE_DAY_IN_MS);
    const recentSwaps = await params.db
      .select()
      .from(schema.pairSwaps)
      .where(and(eq(schema.pairSwaps.pairAddress, pair.pairAddress), gte(schema.pairSwaps.blockTimestamp, oneDayAgo)));
    const reserve0 = BigInt(pair.reserve0);
    const reserve1 = BigInt(pair.reserve1);
    const resourceTokenAddress = resolveResourceTokenAddress(pair, lordsAddress);
    const volume0 = recentSwaps.reduce(
      (sum: bigint, row: any) => sum + BigInt(row.amount0In) + BigInt(row.amount0Out),
      0n,
    );
    const volume1 = recentSwaps.reduce(
      (sum: bigint, row: any) => sum + BigInt(row.amount1In) + BigInt(row.amount1Out),
      0n,
    );
    const lpFees0 = recentSwaps.reduce(
      (sum: bigint, row: any) => sum + computeLpFee(BigInt(row.amount0In), BigInt(row.feeAmount)),
      0n,
    );
    const lpFees1 = recentSwaps.reduce(
      (sum: bigint, row: any) => sum + computeLpFee(BigInt(row.amount1In), BigInt(row.feeAmount)),
      0n,
    );
    const resourceTokenSupply = resourceTokenAddress !== null ? await loadTokenTotalSupply(resourceTokenAddress) : null;
    const lpHolderCountResult = await params.db
      .select({ total: count() })
      .from(schema.pairLpBalances)
      .where(and(eq(schema.pairLpBalances.pairAddress, pair.pairAddress), gte(schema.pairLpBalances.balance, "1")));
    const lpHolderCount = lpHolderCountResult[0]?.total ?? 0;

    return jsonResponse(c, {
      data: {
        pairAddress: pair.pairAddress,
        reserve0: pair.reserve0,
        reserve1: pair.reserve1,
        totalLpSupply: pair.totalLpSupply,
        feeAmount: factory?.feeAmount ?? "997",
        feeTo: factory?.feeTo ?? "0x0",
        spotPriceToken1PerToken0: computeSpotPrice(reserve0, reserve1),
        spotPriceToken0PerToken1: computeSpotPrice(reserve1, reserve0),
        volume0_24h: volume0.toString(),
        volume1_24h: volume1.toString(),
        lpFees0_24h: lpFees0.toString(),
        lpFees1_24h: lpFees1.toString(),
        swapCount24h: recentSwaps.length,
        resourceTokenSupply,
        lpHolderCount,
      },
    });
  });

  app.get("/api/v1/users/:address/positions", async (c: any) => {
    const ownerAddress = normalizeAddress(c.req.param("address"));
    return jsonResponse(c, { data: await buildUserPositions(params.db, ownerAddress) });
  });

  return app;
}

function buildAllowedBrowserOriginSet(origins: string[]): Set<string> {
  return new Set(
    origins.map((origin) => normalizeBrowserOrigin(origin)).filter((origin): origin is string => origin !== null),
  );
}

function isAllowedBrowserOrigin(origin: string, allowedOrigins: Set<string>): boolean {
  const normalizedOrigin = normalizeBrowserOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  const parsedOrigin = new URL(normalizedOrigin);
  return (
    LOCAL_BROWSER_HOSTNAMES.has(parsedOrigin.hostname) ||
    isFirstPartyRealmsBrowserOrigin(parsedOrigin) ||
    allowedOrigins.has(normalizedOrigin)
  );
}

function normalizeBrowserOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function isFirstPartyRealmsBrowserOrigin(origin: URL): boolean {
  return origin.protocol === "https:" && matchesFirstPartyRealmsHostname(origin.hostname);
}

function matchesFirstPartyRealmsHostname(hostname: string): boolean {
  return hostname === FIRST_PARTY_BROWSER_DOMAIN || hostname.endsWith(`.${FIRST_PARTY_BROWSER_DOMAIN}`);
}

function parsePagination(c: { req: { query: (key: string) => string | undefined } }): PaginationParams {
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

function jsonResponse(c: { json: (body: unknown, status?: number) => Response }, body: unknown, status?: number) {
  return c.json(toJsonSafe(body), status);
}

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      typeof currentValue === "bigint" ? currentValue.toString() : currentValue,
    ),
  ) as T;
}

function buildTimeConditions(baseCondition: any, from: string | undefined, to: string | undefined, column: any) {
  const conditions = [baseCondition];

  if (from) {
    conditions.push(gte(column, new Date(from)));
  }

  if (to) {
    conditions.push(lte(column, new Date(to)));
  }

  return conditions;
}

async function buildPairSummaries(db: any, pairRows: any[]) {
  return Promise.all(pairRows.map((pair) => buildPairSummary(db, pair)));
}

async function buildPairSummary(db: any, pair: any) {
  const factory = await loadFactoryOrNull(db, pair.factoryAddress);

  return {
    pairAddress: pair.pairAddress,
    factoryAddress: pair.factoryAddress,
    token0Address: pair.token0Address,
    token1Address: pair.token1Address,
    lpTokenAddress: pair.lpTokenAddress,
    reserve0: pair.reserve0,
    reserve1: pair.reserve1,
    totalLpSupply: pair.totalLpSupply,
    feeAmount: factory?.feeAmount ?? "997",
    feeTo: factory?.feeTo ?? "0x0",
  };
}

async function buildUserPositions(db: any, ownerAddress: string) {
  const balanceRows = await loadPositiveLpBalancesForOwner(db, ownerAddress);

  if (balanceRows.length === 0) {
    return [];
  }

  const pairsByAddress = await loadPairsByAddress(
    db,
    balanceRows.map((row: any) => row.pairAddress),
  );

  return balanceRows
    .map((balanceRow: any) => buildUserPosition(balanceRow, pairsByAddress.get(balanceRow.pairAddress)))
    .filter(
      (position: ReturnType<typeof buildUserPosition>): position is NonNullable<typeof position> => position !== null,
    )
    .sort(comparePositionsByLpBalance);
}

async function loadPositiveLpBalancesForOwner(db: any, ownerAddress: string) {
  const balanceRows = await db
    .select()
    .from(schema.pairLpBalances)
    .where(eq(schema.pairLpBalances.ownerAddress, ownerAddress));

  return balanceRows.filter((row: any) => BigInt(row.balance) > 0n);
}

async function loadPairsByAddress(db: any, pairAddresses: string[]) {
  const rows = await db.select().from(schema.pairs).where(inArray(schema.pairs.pairAddress, pairAddresses));
  return new Map(rows.map((row: any) => [row.pairAddress, row]));
}

function buildUserPosition(balanceRow: any, pair: any) {
  if (!pair) {
    return null;
  }

  const lpBalance = BigInt(balanceRow.balance);
  const totalLpSupply = BigInt(pair.totalLpSupply);

  return {
    pairAddress: pair.pairAddress,
    factoryAddress: pair.factoryAddress,
    token0Address: pair.token0Address,
    token1Address: pair.token1Address,
    lpTokenAddress: pair.lpTokenAddress,
    lpBalance: lpBalance.toString(),
    totalLpSupply: pair.totalLpSupply,
    poolShare: computePoolShare(lpBalance, totalLpSupply),
    amount0: computeUnderlyingAmount(pair.reserve0, lpBalance, totalLpSupply),
    amount1: computeUnderlyingAmount(pair.reserve1, lpBalance, totalLpSupply),
  };
}

async function loadPairOrNull(db: any, pairAddress: string) {
  const rows = await db
    .select()
    .from(schema.pairs)
    .where(eq(schema.pairs.pairAddress, normalizeAddress(pairAddress)))
    .limit(1);
  return rows[0] ?? null;
}

async function loadFactoryOrNull(db: any, factoryAddress: string) {
  const rows = await db
    .select()
    .from(schema.factories)
    .where(eq(schema.factories.factoryAddress, factoryAddress))
    .limit(1);
  return rows[0] ?? null;
}

function computeSpotPrice(base: bigint, quote: bigint): number {
  if (base === 0n || quote === 0n) {
    return 0;
  }

  return Number(quote) / Number(base);
}

function computeLpFee(amountIn: bigint, feeAmount: bigint): bigint {
  if (amountIn <= 0n || feeAmount <= 0n) {
    return 0n;
  }

  return (amountIn * (1000n - feeAmount)) / 1000n;
}

function computeUnderlyingAmount(reserve: string, lpBalance: bigint, totalLpSupply: bigint): string {
  if (lpBalance <= 0n || totalLpSupply <= 0n) {
    return "0";
  }

  return ((BigInt(reserve) * lpBalance) / totalLpSupply).toString();
}

function computePoolShare(lpBalance: bigint, totalLpSupply: bigint): number {
  if (lpBalance <= 0n || totalLpSupply <= 0n) {
    return 0;
  }

  return Number((lpBalance * 10000n) / totalLpSupply) / 100;
}

function comparePositionsByLpBalance(left: { lpBalance: string }, right: { lpBalance: string }) {
  const leftBalance = BigInt(left.lpBalance);
  const rightBalance = BigInt(right.lpBalance);

  if (leftBalance === rightBalance) {
    return 0;
  }

  return leftBalance > rightBalance ? -1 : 1;
}

function normalizeOptionalAddress(value: string | undefined): string | undefined {
  return value ? normalizeAddress(value) : undefined;
}

function resolveResourceTokenAddress(
  pair: { token0Address: string; token1Address: string },
  lordsAddress: string | undefined,
): string | null {
  if (!lordsAddress) {
    return null;
  }

  if (normalizeAddress(pair.token0Address) === lordsAddress) {
    return normalizeAddress(pair.token1Address);
  }

  if (normalizeAddress(pair.token1Address) === lordsAddress) {
    return normalizeAddress(pair.token0Address);
  }

  return null;
}

function buildTokenTotalSupplyLoader(rpcUrl: string | undefined): LoadTokenTotalSupply {
  if (!rpcUrl) {
    return async () => null;
  }

  const provider = new RpcProvider({ nodeUrl: rpcUrl });

  return async (tokenAddress: string) => {
    try {
      const result = await provider.callContract({
        contractAddress: tokenAddress,
        entrypoint: "total_supply",
        calldata: [],
      });

      return parseU256Result(result);
    } catch {
      return null;
    }
  };
}

function parseU256Result(values: Array<string | bigint>): bigint {
  const low = BigInt(values[0] ?? "0x0");
  const high = BigInt(values[1] ?? "0x0");
  return low + (high << 128n);
}

function normalizeAddress(value: string): string {
  if (!value.startsWith("0x")) {
    return value;
  }

  return `0x${value.slice(2).replace(/^0+/, "").toLowerCase() || "0"}`;
}
