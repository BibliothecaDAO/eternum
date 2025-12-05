import type { Market, MarketCreated, MarketOutcome, VaultDenominator, VaultNumerator } from "./bindings";

export type MarketClassArgs = {
  market: Market;
  marketCreated?: MarketCreated;
  collateralToken?: unknown;
  vaultDenominator?: VaultDenominator;
  vaultNumerators?: VaultNumerator[];
  conditionResolution?: unknown;
};

const toNumber = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export class MarketClass {
  market: Market;
  marketCreated?: MarketCreated;
  collateralToken?: unknown;
  vaultDenominator?: VaultDenominator;
  vaultNumerators?: VaultNumerator[];
  conditionResolution?: unknown;

  constructor(args: MarketClassArgs) {
    this.market = args.market;
    this.marketCreated = args.marketCreated;
    this.collateralToken = args.collateralToken;
    this.vaultDenominator = args.vaultDenominator;
    this.vaultNumerators = args.vaultNumerators;
    this.conditionResolution = args.conditionResolution;
  }

  get market_id() {
    return this.market.market_id;
  }

  get title() {
    return this.marketCreated?.title ?? this.market.title ?? "Untitled market";
  }

  get terms() {
    return this.marketCreated?.terms ?? this.market.terms;
  }

  get outcomes(): MarketOutcome[] {
    return (this.market as any)?.outcomes || [];
  }

  get start_at() {
    return this.market.start_at ?? this.market.created_at;
  }

  get resolve_at() {
    return this.market.resolve_at ?? this.market.resolved_at;
  }

  get resolved_at() {
    return this.market.resolved_at;
  }

  get created_at() {
    return this.market.created_at ?? this.start_at;
  }

  get status() {
    const nowSec = Math.floor(Date.now() / 1_000);
    const resolvedAt = toNumber(this.resolved_at);
    const resolveAt = toNumber(this.resolve_at);

    if (resolvedAt && resolvedAt > 0) return "resolved";
    if (resolveAt && resolveAt < nowSec) return "resolvable";
    return "open";
  }

  get tvl() {
    const denominator = toNumber(this.vaultDenominator?.value);
    if (denominator == null || denominator === 0) return this.market.tvl;

    const numeratorSum = (this.vaultNumerators || []).reduce((acc, item) => acc + (toNumber(item.value) ?? 0), 0);
    if (numeratorSum === 0) return this.market.tvl;
    return numeratorSum / denominator;
  }
}
