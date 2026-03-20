/**
 * Router config resolver — fetches and caches the x402 router's `/v1/config`
 * endpoint with a 5-minute TTL.
 */

import { normalizeRouterConfig } from "./router-config.js";
import type { RouterConfig } from "./types.js";

/** Default TTL for cached router config: 5 minutes. */
const DEFAULT_ROUTER_CONFIG_TTL_MS = 5 * 60 * 1000;

/** Options for {@link createRouterConfigResolver}. */
interface CreateRouterConfigResolverOptions {
  /** Base URL of the x402 router. */
  routerUrl: string;
  /** Preferred CAIP-2 network; falls back to the router's active network. */
  network?: string;
  /** Override the payment header name from the router response. */
  paymentHeader?: string;
  /** Custom fetch implementation (default: global `fetch`). */
  baseFetch?: typeof fetch;
  /** Cache TTL in milliseconds (default: 5 min). */
  ttlMs?: number;
  /** Clock function returning current time in ms. */
  now?: () => number;
}

interface CachedRouterConfig {
  config: RouterConfig;
  expiresAt: number;
}

function withConfigPath(routerUrl: string): string {
  return routerUrl.endsWith("/") ? `${routerUrl}v1/config` : `${routerUrl}/v1/config`;
}

/**
 * Create a cached resolver that fetches and normalizes the router's config.
 *
 * Returns a function that resolves to a {@link RouterConfig}. Subsequent calls
 * within the TTL window return the cached result without a network request.
 *
 * @param options - Router URL, network preference, and cache settings.
 * @returns An async function `(signal?) => Promise<RouterConfig>`.
 */
export function createRouterConfigResolver(
  options: CreateRouterConfigResolverOptions,
): (signal?: AbortSignal) => Promise<RouterConfig> {
  const baseFetch = options.baseFetch ?? fetch;
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? DEFAULT_ROUTER_CONFIG_TTL_MS;
  const configUrl = withConfigPath(options.routerUrl);
  let cached: CachedRouterConfig | undefined;

  return async (signal?: AbortSignal): Promise<RouterConfig> => {
    const nowMs = now();
    if (cached && cached.expiresAt > nowMs) {
      return cached.config;
    }

    const response = await baseFetch(configUrl, { method: "GET", signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch x402 router config: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    const config = normalizeRouterConfig(payload, {
      network: options.network,
      paymentHeader: options.paymentHeader,
    });
    cached = {
      config,
      expiresAt: nowMs + ttlMs,
    };
    return config;
  };
}

export { DEFAULT_ROUTER_CONFIG_TTL_MS };
