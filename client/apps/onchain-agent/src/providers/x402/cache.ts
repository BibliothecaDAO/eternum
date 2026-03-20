/**
 * ERC-2612 permit cache — stores signed permits keyed by
 * `network::asset::payTo::maxValue` and evicts them 5 seconds before
 * their on-chain deadline to account for clock skew.
 */

import type { CachedPermit, ErrorResponse } from "./types.js";

export type { CachedPermit } from "./types.js";

/** Seconds subtracted from the permit deadline to avoid clock-skew rejections. */
const CLOCK_SKEW_SECONDS = 5;

function cacheKey(network: string, asset: string, payTo: string, maxValue: string): string {
  return `${network.toLowerCase()}::${asset.toLowerCase()}::${payTo.toLowerCase()}::${maxValue}`;
}

/**
 * TTL-based cache for signed ERC-2612 USDC permits.
 *
 * Permits are keyed by `(network, asset, payTo, maxValue)` and automatically
 * evicted when their deadline is within {@link CLOCK_SKEW_SECONDS} of expiry.
 */
export class PermitCache {
  private readonly cache = new Map<string, CachedPermit>();

  constructor(private readonly now: () => number = () => Math.floor(Date.now() / 1000)) {}

  /** Return a cached permit if one exists and has not expired, otherwise `undefined`. */
  get(network: string, asset: string, payTo: string, maxValue: string): CachedPermit | undefined {
    const key = cacheKey(network, asset, payTo, maxValue);
    const permit = this.cache.get(key);
    if (!permit) return undefined;
    if (permit.deadline <= this.now() + CLOCK_SKEW_SECONDS) {
      this.cache.delete(key);
      return undefined;
    }
    return permit;
  }

  /** Store a signed permit in the cache. */
  set(permit: CachedPermit): void {
    this.cache.set(cacheKey(permit.network, permit.asset, permit.payTo, permit.maxValue), permit);
  }

  /** Remove a specific permit from the cache (e.g. after a 402 rejection). */
  invalidate(network: string, asset: string, payTo: string, maxValue: string): void {
    this.cache.delete(cacheKey(network, asset, payTo, maxValue));
  }

  /** Remove all cached permits. */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Return `true` if the error indicates the permit is stale and should be
 * re-signed (expired, wrong nonce, or invalid signature).
 */
export function shouldInvalidatePermit(error: ErrorResponse | null | undefined): boolean {
  if (!error) return false;

  const combined = `${error.code ?? ""} ${error.error ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    combined.includes("invalid_payment_signature") ||
    combined.includes("invalid payment signature") ||
    combined.includes("invalid permit") ||
    combined.includes("permit expired") ||
    combined.includes("nonce too low")
  );
}
