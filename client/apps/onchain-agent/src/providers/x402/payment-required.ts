/**
 * 402 Payment Required response parsing — decodes the base64-encoded
 * `PAYMENT-REQUIRED` header and extracts payment requirements so the
 * fetch wrapper can retry with updated permit parameters.
 */

import { shouldInvalidatePermit } from "./cache.js";
import type { ErrorResponse, PaymentRequiredHeader, PaymentRequirement, RouterConfig } from "./types.js";

/** Decode the base64-encoded `PAYMENT-REQUIRED` header into a typed object. */
export function decodePaymentRequiredHeader(value: string): PaymentRequiredHeader | null {
	try {
		const json = Buffer.from(value, "base64").toString("utf8");
		return JSON.parse(json) as PaymentRequiredHeader;
	} catch {
		return null;
	}
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object") return null;
	return value as Record<string, unknown>;
}

/** Parse a JSON error body into a typed {@link ErrorResponse}, handling nested shapes. */
export function parseErrorResponse(data: unknown): ErrorResponse | null {
	const root = asRecord(data);
	if (!root) return null;

	if (typeof root.code === "string" || typeof root.error === "string") {
		return {
			code: typeof root.code === "string" ? root.code : undefined,
			error: typeof root.error === "string" ? root.error : undefined,
			message: typeof root.message === "string" ? root.message : undefined,
		};
	}

	const nestedError = asRecord(root.error);
	if (!nestedError) return null;

	const code = typeof nestedError.code === "string" ? nestedError.code : undefined;
	const message =
		typeof nestedError.message === "string"
			? nestedError.message
			: typeof nestedError.error === "string"
				? nestedError.error
				: undefined;

	return { code, error: message, message };
}

export { shouldInvalidatePermit };

/** Extract the maximum amount required from a payment requirement (tries multiple field names). */
export function getRequirementMaxAmountRequired(requirement?: PaymentRequirement): string | undefined {
	if (!requirement?.extra) return undefined;
	return (
		requirement.extra.maxAmountRequired ??
		requirement.extra.max_amount_required ??
		requirement.extra.maxAmount ??
		requirement.extra.max_amount
	);
}

function requirementPayTo(requirement?: PaymentRequirement): string | undefined {
	return requirement?.payTo ?? requirement?.pay_to;
}

/** Merge a 402 payment requirement into an existing router config, overriding where the requirement specifies values. */
export function applyPaymentRequirement(config: RouterConfig, requirement?: PaymentRequirement): RouterConfig {
	if (!requirement) return config;

	const payTo = requirementPayTo(requirement) ?? config.payTo;
	const tokenName = requirement.extra?.name ?? config.tokenName;
	const tokenVersion = requirement.extra?.version ?? config.tokenVersion;

	return {
		...config,
		network: requirement.network ?? config.network,
		asset: requirement.asset ?? config.asset,
		payTo,
		facilitatorSigner: payTo || config.facilitatorSigner,
		tokenName,
		tokenVersion,
	};
}
