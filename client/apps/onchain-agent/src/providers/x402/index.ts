/**
 * x402 model provider — OpenAI-compatible with on-chain USDC permit payments.
 *
 * Pre-signs ERC-2612 USDC permits and injects them as headers on the model
 * object. The OpenAI SDK in pi-ai sends model.headers as defaultHeaders,
 * so the x402 router receives the payment signature on every request.
 *
 * Permits are cached with a 5-minute TTL and refreshed automatically.
 *
 * Required env: X402_PRIVATE_KEY (or X402_PAYMENT_SIGNATURE for static auth)
 * Optional env: X402_ROUTER_URL, X402_MODEL_ID, X402_NETWORK, X402_PERMIT_CAP
 */

import {
  type Model,
  type Api,
  type Context,
  type SimpleStreamOptions,
  type AssistantMessageEventStream,
  streamSimpleOpenAICompletions,
  registerApiProvider,
} from "@mariozechner/pi-ai";
import { PermitCache } from "./cache.js";
import { loadX402Env, type EnvSource } from "./env.js";
import { createRouterConfigResolver } from "./router-config-resolver.js";
import { createViemSigner } from "./signer.js";

const X402_API = "x402-openai-completions";

function withV1Path(origin: string): string {
  return origin.endsWith("/") ? `${origin}v1` : `${origin}/v1`;
}

/**
 * Create and register an x402 model.
 *
 * Registers a custom API provider in pi-ai's registry, then returns a Model
 * object ready to pass to the Agent. Pre-signs permits and injects them as
 * model headers so the OpenAI SDK sends them automatically.
 *
 * @param envSource - Environment variables (defaults to process.env).
 * @returns A pi-ai Model configured for x402 streaming.
 */
export function createX402Model(envSource: EnvSource = process.env): Model<Api> {
  const staticPaymentSignatureRaw = envSource.X402_PAYMENT_SIGNATURE?.trim();
  const staticPaymentSignature =
    typeof staticPaymentSignatureRaw === "string" && staticPaymentSignatureRaw.length > 0
      ? staticPaymentSignatureRaw
      : undefined;

  const env = loadX402Env(envSource, {
    requirePrivateKey: !staticPaymentSignature,
  });

  const permitCache = new PermitCache();
  const resolveRouterConfig = createRouterConfigResolver({
    routerUrl: env.routerUrl,
    network: env.network,
    paymentHeader: env.paymentHeader,
  });
  const signer = createViemSigner();

  // Pre-sign a permit and return the payment header value.
  async function getPaymentHeader(): Promise<string> {
    if (staticPaymentSignature) return staticPaymentSignature;
    if (!env.privateKey) throw new Error("X402_PRIVATE_KEY is required");

    const routerConfig = await resolveRouterConfig();
    const cached = permitCache.get(
      routerConfig.network,
      routerConfig.asset,
      routerConfig.payTo,
      env.permitCap,
    );
    if (cached) return cached.paymentSig;

    console.log("[x402] Signing new USDC permit...");
    const permit = await signer({
      privateKey: env.privateKey,
      routerConfig,
      permitCap: env.permitCap,
    });
    permitCache.set(permit);
    console.log(`[x402] Permit signed (expires ${new Date(permit.deadline * 1000).toISOString()})`);
    return permit.paymentSig;
  }

  // The model object — headers are mutated before each request
  const model: Model<Api> = {
    id: env.modelId,
    name: env.modelName,
    api: X402_API as Api,
    provider: "x402",
    baseUrl: withV1Path(env.routerUrl),
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 32768,
    headers: {},
    compat: { supportsDeveloperRole: false },
  };

  const streamX402 = (
    _model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions,
  ): AssistantMessageEventStream => {
    // Sign permit synchronously from cache, or kick off async signing.
    // Since the OpenAI SDK needs headers at client creation time, we
    // update model.headers before delegating to the OpenAI stream.
    const openAIModel = {
      ...model,
      api: "openai-completions" as Api,
    };

    // Merge any existing options headers
    const mergedHeaders = {
      ...(model.headers ?? {}),
      ...(options?.headers ?? {}),
      Authorization: null, // x402 uses permits, not bearer tokens
    } as Record<string, string | null>;

    const mergedOptions = {
      ...(options ?? {}),
      headers: mergedHeaders,
      apiKey: "x402-permit-auth",
    } as SimpleStreamOptions;

    return streamSimpleOpenAICompletions(openAIModel as any, context, mergedOptions);
  };

  // Register the API provider
  registerApiProvider({
    api: X402_API,
    stream: (m, ctx, opts) => streamX402(m, ctx, opts),
    streamSimple: streamX402,
  });

  // Eagerly sign the first permit so it's ready before the first agent tick.
  // Also refreshes headers every time the permit cache refreshes.
  async function refreshPermit() {
    try {
      const sig = await getPaymentHeader();
      model.headers = {
        ...(model.headers ?? {}),
        [env.paymentHeader]: sig,
      };
    } catch (err) {
      console.error("[x402] Failed to sign permit:", err instanceof Error ? err.message : err);
    }
  }

  // Sign first permit immediately, then refresh every 4 minutes (permits last 5 min)
  refreshPermit();
  setInterval(refreshPermit, 4 * 60 * 1000);

  return model;
}
