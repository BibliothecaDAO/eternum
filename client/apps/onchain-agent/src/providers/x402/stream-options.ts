import type { PermitCache } from "./cache.js";
import { createX402Fetch } from "./fetch-wrapper.js";
import type { RouterConfig, SignPermit } from "./types.js";

export interface X402StreamOptions {
	apiKey?: string;
	headers?: Record<string, string | null>;
	fetch?: typeof fetch;
	[key: string]: unknown;
}

interface DynamicX402Runtime {
	routerUrl: string;
	permitCap: string;
	privateKey: string;
	resolveRouterConfig: (signal?: AbortSignal) => Promise<RouterConfig>;
	permitCache: PermitCache;
	signer: SignPermit;
}

interface StaticX402Runtime {
	routerUrl: string;
	permitCap: string;
	staticPaymentSignature: string;
	paymentHeader: string;
}

type X402Runtime = DynamicX402Runtime | StaticX402Runtime;

function mergeHeaders(
	baseHeaders: Record<string, string | null> | undefined,
	overrideHeaders: Record<string, string | null>,
): Record<string, string | null> {
	return { ...(baseHeaders ?? {}), ...overrideHeaders };
}

export function buildX402StreamOptions(
	options: X402StreamOptions | undefined,
	runtime: X402Runtime,
): X402StreamOptions {
	const baseFetch = options?.fetch ?? fetch;
	const baseHeaders = options?.headers;

	if ("staticPaymentSignature" in runtime) {
		return {
			...(options ?? {}),
			headers: mergeHeaders(baseHeaders, {
				[runtime.paymentHeader]: runtime.staticPaymentSignature,
			}),
			fetch: baseFetch,
		};
	}

	const wrappedFetch = createX402Fetch({
		baseFetch,
		resolveRouterConfig: runtime.resolveRouterConfig,
		permitCache: runtime.permitCache,
		permitCap: runtime.permitCap,
		privateKey: runtime.privateKey,
		routerUrl: runtime.routerUrl,
		signer: runtime.signer,
	});

	return {
		...(options ?? {}),
		fetch: wrappedFetch,
	};
}
