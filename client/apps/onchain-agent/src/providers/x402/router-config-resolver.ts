import { normalizeRouterConfig } from "./router-config.js";
import type { RouterConfig } from "./types.js";

const DEFAULT_ROUTER_CONFIG_TTL_MS = 5 * 60 * 1000;

interface CreateRouterConfigResolverOptions {
	routerUrl: string;
	network?: string;
	paymentHeader?: string;
	baseFetch?: typeof fetch;
	ttlMs?: number;
	now?: () => number;
}

interface CachedRouterConfig {
	config: RouterConfig;
	expiresAt: number;
}

function withConfigPath(routerUrl: string): string {
	return routerUrl.endsWith("/") ? `${routerUrl}v1/config` : `${routerUrl}/v1/config`;
}

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
