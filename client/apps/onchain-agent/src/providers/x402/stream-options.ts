/**
 * Stream options builder — merges x402 payment headers or a wrapped fetch
 * into the pi-ai stream options, depending on whether static or dynamic
 * permit mode is active.
 */

import type { PermitCache } from "./cache.js";
import { createX402Fetch } from "./fetch-wrapper.js";
import type { RouterConfig, SignPermit } from "./types.js";

/** Streaming options passed through to the OpenAI-compatible completion call. */
export interface X402StreamOptions {
	apiKey?: string;
	headers?: Record<string, string | null>;
	fetch?: typeof fetch;
	[key: string]: unknown;
}

/** Runtime that signs permits dynamically using a private key and signer. */
interface DynamicX402Runtime {
	routerUrl: string;
	permitCap: string;
	privateKey: string;
	resolveRouterConfig: (signal?: AbortSignal) => Promise<RouterConfig>;
	permitCache: PermitCache;
	signer: SignPermit;
}

/** Runtime that uses a pre-signed static payment signature (no on-chain signing). */
interface StaticX402Runtime {
	routerUrl: string;
	permitCap: string;
	staticPaymentSignature: string;
	paymentHeader: string;
}

/** Either a dynamic (permit-signing) or static (pre-signed) x402 runtime. */
type X402Runtime = DynamicX402Runtime | StaticX402Runtime;

function mergeHeaders(
	baseHeaders: Record<string, string | null> | undefined,
	overrideHeaders: Record<string, string | null>,
): Record<string, string | null> {
	return { ...(baseHeaders ?? {}), ...overrideHeaders };
}

/**
 * Merge x402 payment auth into stream options.
 *
 * For static mode, injects the payment header directly. For dynamic mode,
 * wraps `fetch` with {@link createX402Fetch} so permits are signed and
 * injected transparently on each request.
 *
 * @param options - Base stream options to extend.
 * @param runtime - Active x402 runtime (static or dynamic).
 * @returns Extended stream options with payment auth applied.
 */
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
