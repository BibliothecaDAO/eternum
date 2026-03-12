/**
 * x402 model provider — OpenAI-compatible with on-chain USDC permit payments.
 *
 * Wraps pi-ai's OpenAI completions streaming with x402 payment signing.
 * When MODEL_PROVIDER=x402, creates a Model object that routes through
 * the x402 router (ai.xgate.run) with automatic ERC-2612 permit signing.
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
import { buildX402StreamOptions } from "./stream-options.js";

const X402_API = "x402-openai-completions";

function withV1Path(origin: string): string {
  return origin.endsWith("/") ? `${origin}v1` : `${origin}/v1`;
}

/**
 * Create and register an x402 model.
 *
 * Registers a custom API provider in pi-ai's registry, then returns a Model
 * object ready to pass to the Agent. Handles permit signing automatically.
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

  // Build the stream function
  const permitCache = new PermitCache();
  const resolveRouterConfig = createRouterConfigResolver({
    routerUrl: env.routerUrl,
    network: env.network,
    paymentHeader: env.paymentHeader,
  });
  const signer = createViemSigner();

  const streamX402 = (
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions,
  ): AssistantMessageEventStream => {
    const openAIModel = {
      ...model,
      api: "openai-completions",
    } as Model<"openai-completions">;

    // Clear the Authorization header — x402 uses payment permits, not bearer tokens
    const headers = {
      ...(options?.headers ?? {}),
      Authorization: null,
    } as Record<string, string | null>;

    const baseOptions = {
      ...(options ?? {}),
      headers,
    };

    const x402Options = staticPaymentSignature
      ? buildX402StreamOptions(baseOptions, {
          routerUrl: env.routerUrl,
          permitCap: env.permitCap,
          staticPaymentSignature,
          paymentHeader: env.paymentHeader,
        })
      : (() => {
          if (!env.privateKey) {
            throw new Error("X402_PRIVATE_KEY is required unless X402_PAYMENT_SIGNATURE is set");
          }
          return buildX402StreamOptions(baseOptions, {
            routerUrl: env.routerUrl,
            permitCap: env.permitCap,
            privateKey: env.privateKey,
            resolveRouterConfig,
            permitCache,
            signer,
          });
        })();

    return streamSimpleOpenAICompletions(openAIModel, context, {
      ...x402Options,
      apiKey: options?.apiKey ?? "x402-placeholder",
    } as SimpleStreamOptions);
  };

  // Register the x402 API provider so pi-ai can route to it
  registerApiProvider({
    api: X402_API,
    stream: (model, context, options) => streamX402(model, context, options),
    streamSimple: streamX402,
  });

  // Build the model object
  const model: Model<Api> = {
    id: env.modelId,
    name: env.modelName,
    api: X402_API as Api,
    provider: "x402",
    baseUrl: withV1Path(env.routerUrl),
    reasoning: true,
    input: ["text", "image"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 200000,
    maxTokens: 32768,
    compat: {
      supportsDeveloperRole: false,
    },
  };

  if (staticPaymentSignature) {
    model.headers = { [env.paymentHeader]: staticPaymentSignature };
  }

  return model;
}
