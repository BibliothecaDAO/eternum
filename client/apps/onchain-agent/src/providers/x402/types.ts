/**
 * Shared type definitions for the x402 payment-authenticated model provider.
 *
 * @module
 */

/** Validated environment configuration for the x402 provider. */
export interface X402EnvConfig {
  /** 0x-prefixed 64-byte hex private key for permit signing. Undefined when using static auth. */
  privateKey?: string;
  /** Base URL of the x402 router (e.g. `"https://ai.xgate.run"`). */
  routerUrl: string;
  /** CAIP-2 network identifier (e.g. `"eip155:8453"` for Base mainnet). */
  network: string;
  /** Maximum USDC amount (in smallest unit) the permit authorizes per request. */
  permitCap: string;
  /** HTTP header name used to transmit the payment signature. */
  paymentHeader: string;
  /** LLM model identifier sent to the router. */
  modelId: string;
  /** Human-readable model name for logging. */
  modelName: string;
}

/** Resolved router configuration describing the payment target and EIP-712 domain. */
export interface RouterConfig {
  /** CAIP-2 network identifier (e.g. `"eip155:8453"`). */
  network: string;
  /** USDC token contract address on the target network. */
  asset: string;
  /** Address that receives the payment. */
  payTo: string;
  /** Address used as the ERC-2612 permit spender (typically same as `payTo`). */
  facilitatorSigner: string;
  /** EIP-712 domain `name` for the USDC permit (e.g. `"USD Coin"`). */
  tokenName: string;
  /** EIP-712 domain `version` for the USDC permit (e.g. `"2"`). */
  tokenVersion: string;
  /** HTTP header name for the payment signature. */
  paymentHeader: string;
}

/** Raw JSON shape returned by the router's `/v1/config` endpoint. */
export interface RouterConfigResponse {
  networks?: Array<{
    network_id?: string;
    active?: boolean;
    asset?: { address?: string };
    pay_to?: string;
  }>;
  eip712_config?: {
    domain_name?: string;
    domain_version?: string;
  };
  payment_header?: string;
}

/** Extra fields inside a 402 payment requirement (amount caps, EIP-712 hints). */
export interface PaymentRequirementExtra {
  name?: string;
  version?: string;
  maxAmount?: string;
  max_amount?: string;
  maxAmountRequired?: string;
  max_amount_required?: string;
}

/** A single accepted payment option from a 402 response. */
export interface PaymentRequirement {
  network?: string;
  asset?: string;
  payTo?: string;
  pay_to?: string;
  extra?: PaymentRequirementExtra;
}

/** Decoded `PAYMENT-REQUIRED` response header from a 402 response. */
export interface PaymentRequiredHeader {
  x402Version?: number;
  error?: string;
  accepts?: PaymentRequirement[];
}

/** Structured error body returned by the x402 router on auth failures. */
export interface ErrorResponse {
  code?: string;
  error?: string;
  message?: string;
}

/** A signed ERC-2612 permit cached for reuse until its deadline expires. */
export interface CachedPermit {
  /** Base64-encoded payment payload containing the permit signature. */
  paymentSig: string;
  /** Unix timestamp (seconds) when the permit expires. */
  deadline: number;
  /** Maximum USDC value authorized by the permit. */
  maxValue: string;
  /** ERC-2612 nonce used in the permit. */
  nonce: string;
  /** CAIP-2 network the permit targets. */
  network: string;
  /** USDC contract address the permit targets. */
  asset: string;
  /** Address the permit authorizes spending to. */
  payTo: string;
}

/** Parameters for signing a new ERC-2612 USDC permit. */
export interface SignPermitParams {
  /** 0x-prefixed 64-byte hex private key of the permit owner. */
  privateKey: string;
  /** Router configuration describing the payment target and EIP-712 domain. */
  routerConfig: RouterConfig;
  /** Maximum USDC amount (smallest unit) to authorize. */
  permitCap: string;
}

/** Function that signs an ERC-2612 permit and returns a {@link CachedPermit}. */
export type SignPermit = (params: SignPermitParams) => Promise<CachedPermit>;
