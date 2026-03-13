import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_TORII_URL = "https://example.test/torii";
const ZERO_U64_HEX = "0x0000000000000000";

vi.mock("../../prediction-market-config", () => ({
  getPredictionMarketConfig: () => ({
    toriiUrl: TEST_TORII_URL,
    worldAddress: "0x0",
  }),
}));

let getPmSqlApiForUrl: (toriiUrl: string) => {
  fetchMarketsCount: (filters: { status: unknown; type: unknown; oracle: string }, now: number) => Promise<number>;
  fetchMarketBuyOutcomesByMarketAndAccount: (
    marketId: string,
    accountAddress: string,
  ) => Promise<Array<{ outcome_index: string; amount: string }>>;
  fetchMarketBuyUniqueAccountsCountByMarket: (marketId: string) => Promise<number>;
};
let MarketStatusFilter: Record<"Open" | "Resolved", unknown>;
let MarketTypeFilter: Record<"All", unknown>;

const getQueryFromMockCall = (fetchMock: ReturnType<typeof vi.fn>) => {
  const firstCall = fetchMock.mock.calls[0];
  const url = firstCall?.[0];
  if (!url) return "";
  return new URL(String(url)).searchParams.get("query") ?? "";
};

describe("pm-sql-api status filter query generation", () => {
  beforeAll(async () => {
    const module = await import("./pm-sql-api");
    getPmSqlApiForUrl = module.getPmSqlApiForUrl as unknown as typeof getPmSqlApiForUrl;
    MarketStatusFilter = module.MarketStatusFilter as unknown as typeof MarketStatusFilter;
    MarketTypeFilter = module.MarketTypeFilter as unknown as typeof MarketTypeFilter;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds Open status filter with hex timestamp comparisons", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ total: "0" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = getPmSqlApiForUrl(TEST_TORII_URL);
    const now = 1_741_000_000;
    const nowHex = `0x${now.toString(16).padStart(16, "0")}`;

    await api.fetchMarketsCount({ status: MarketStatusFilter.Open, type: MarketTypeFilter.All, oracle: "All" }, now);

    const query = getQueryFromMockCall(fetchMock);
    expect(query).toContain(`LOWER(m.start_at) < '${nowHex}'`);
    expect(query).toContain(`LOWER(m.resolve_at) > '${nowHex}'`);
    expect(query).toContain(`LOWER(m.resolved_at) = '${ZERO_U64_HEX}'`);
    expect(query).not.toContain("CAST(m.resolve_at AS INTEGER)");
    expect(query).not.toContain("CAST(m.resolved_at AS INTEGER)");
  });

  it("builds Resolved status filter against non-zero hex value", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ total: "3" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = getPmSqlApiForUrl(TEST_TORII_URL);
    const now = 1_741_000_000;

    await api.fetchMarketsCount(
      { status: MarketStatusFilter.Resolved, type: MarketTypeFilter.All, oracle: "All" },
      now,
    );

    const query = getQueryFromMockCall(fetchMock);
    expect(query).toContain(`LOWER(m.resolved_at) > '${ZERO_U64_HEX}'`);
  });

  it("builds account-scoped buy outcomes query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = getPmSqlApiForUrl(TEST_TORII_URL);
    await api.fetchMarketBuyOutcomesByMarketAndAccount("0xabc", "0xdef");

    const query = getQueryFromMockCall(fetchMock);
    expect(query).toContain('FROM "pm-MarketBuy"');
    expect(query).toContain("market_id = '0xabc'");
    expect(query).toContain("LOWER(account_address) = LOWER('0xdef')");
    expect(query).toContain("SELECT outcome_index, amount");
  });

  it("builds unique buyer count query for a market", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ total: "12" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = getPmSqlApiForUrl(TEST_TORII_URL);
    const total = await api.fetchMarketBuyUniqueAccountsCountByMarket("0xabc");

    const query = getQueryFromMockCall(fetchMock);
    expect(query).toContain("COUNT(DISTINCT account_address) as total");
    expect(query).toContain('FROM "pm-MarketBuy"');
    expect(query).toContain("market_id = '0xabc'");
    expect(total).toBe(12);
  });
});
