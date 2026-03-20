/**
 * x402 fetch wrapper — intercepts outgoing requests to the router URL,
 * injects a signed USDC permit header, and retries once on 401/402 with
 * a fresh permit if the previous one was invalidated.
 */

import { type PermitCache, shouldInvalidatePermit } from "./cache.js";
import {
  applyPaymentRequirement,
  decodePaymentRequiredHeader,
  getRequirementMaxAmountRequired,
  parseErrorResponse,
} from "./payment-required.js";
import type { CachedPermit, RouterConfig, SignPermit } from "./types.js";

/** Configuration for {@link createX402Fetch}. */
interface X402FetchOptions {
  /** Underlying fetch to delegate non-x402 requests to (default: global `fetch`). */
  baseFetch?: typeof fetch;
  /** Resolves the router config (payment target, EIP-712 domain). */
  resolveRouterConfig: (signal?: AbortSignal) => Promise<RouterConfig>;
  /** Cache for signed permits. */
  permitCache: PermitCache;
  /** Maximum USDC value to authorize per permit. */
  permitCap: string;
  /** 0x-prefixed private key for permit signing. */
  privateKey: string;
  /** Base URL of the x402 router. */
  routerUrl: string;
  /** Function that signs a new ERC-2612 permit. */
  signer: SignPermit;
}

function normalizeRouterOrigin(routerUrl: string): string {
  try {
    return new URL(routerUrl).origin;
  } catch {
    return routerUrl;
  }
}

function extractUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function shouldSkipInjection(pathname: string): boolean {
  return (
    pathname.endsWith("/config") ||
    pathname.endsWith("/v1/config") ||
    pathname.endsWith("/models") ||
    pathname.endsWith("/v1/models")
  );
}

function withHeader(
  input: string | URL | Request,
  init: RequestInit | undefined,
  headerName: string,
  value: string,
): RequestInit {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) {
    new Headers(init.headers).forEach((headerValue, headerKey) => {
      headers.set(headerKey, headerValue);
    });
  }
  headers.set(headerName, value);
  return { ...init, headers };
}

async function extractErrorResponse(response: Response) {
  try {
    const data = (await response.clone().json()) as unknown;
    return parseErrorResponse(data);
  } catch {
    return null;
  }
}

/**
 * Create a `fetch` drop-in replacement that auto-injects x402 payment headers.
 *
 * Requests to the router origin get a signed permit header. On a 401/402
 * response indicating an invalid permit, the cache is cleared and the
 * request is retried with a fresh permit. Non-router requests pass through.
 *
 * @param options - Router URL, signer, cache, and permit configuration.
 * @returns A `fetch`-compatible function.
 */
export function createX402Fetch(options: X402FetchOptions): typeof fetch {
  const baseFetch = options.baseFetch ?? fetch;
  const routerOrigin = normalizeRouterOrigin(options.routerUrl);

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const rawUrl = extractUrl(input);
    let requestUrl: URL;
    try {
      requestUrl = new URL(rawUrl, routerOrigin);
    } catch {
      return baseFetch(input, init);
    }

    if (requestUrl.origin !== routerOrigin || shouldSkipInjection(requestUrl.pathname)) {
      return baseFetch(input, init);
    }

    const initialRouterConfig = await options.resolveRouterConfig(init?.signal ?? undefined);
    const sendWithPermit = async (routerConfig: RouterConfig, permitCap: string): Promise<Response> => {
      const cached = options.permitCache.get(routerConfig.network, routerConfig.asset, routerConfig.payTo, permitCap);
      const permit: CachedPermit =
        cached ??
        (await options.signer({
          privateKey: options.privateKey,
          routerConfig,
          permitCap,
        }));
      if (!cached) {
        options.permitCache.set(permit);
      }

      const requestInit = withHeader(input, init, routerConfig.paymentHeader, permit.paymentSig);
      return baseFetch(input, requestInit);
    };

    const firstResponse = await sendWithPermit(initialRouterConfig, options.permitCap);
    if (firstResponse.status !== 401 && firstResponse.status !== 402) {
      return firstResponse;
    }

    const parsedError = await extractErrorResponse(firstResponse);
    if (!shouldInvalidatePermit(parsedError)) {
      return firstResponse;
    }

    const paymentRequiredHeader = firstResponse.headers.get("PAYMENT-REQUIRED");
    const decodedPaymentRequired = paymentRequiredHeader ? decodePaymentRequiredHeader(paymentRequiredHeader) : null;
    const requirement = decodedPaymentRequired?.accepts?.[0];
    const retryRouterConfig = applyPaymentRequirement(initialRouterConfig, requirement);
    const requiredPermitCap = getRequirementMaxAmountRequired(requirement) ?? options.permitCap;

    options.permitCache.invalidate(
      initialRouterConfig.network,
      initialRouterConfig.asset,
      initialRouterConfig.payTo,
      options.permitCap,
    );
    if (
      retryRouterConfig.network !== initialRouterConfig.network ||
      retryRouterConfig.asset !== initialRouterConfig.asset ||
      retryRouterConfig.payTo !== initialRouterConfig.payTo ||
      requiredPermitCap !== options.permitCap
    ) {
      options.permitCache.invalidate(
        retryRouterConfig.network,
        retryRouterConfig.asset,
        retryRouterConfig.payTo,
        requiredPermitCap,
      );
    }

    return sendWithPermit(retryRouterConfig, requiredPermitCap);
  };
}
