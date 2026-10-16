import * as Data from "effect/Data";
import * as Schema from "effect/Schema";
import * as Result from "effect/Result";

export class ServiceResponseFailure extends Data.TaggedError("ServiceResponseFailure")<{
  stage: string;
  status: number;
  code: string;
  message: string;
}> {}

const failureChain = (error: unknown): unknown[] => {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = current instanceof Error ? current.cause : undefined;
  }
  return chain.reverse();
};

const declaredCode = (chain: unknown[], codes: readonly string[], fallback: string): string => {
  for (const error of chain) {
    const candidates =
      error instanceof ServiceResponseFailure
        ? [error.stage, error.code]
        : error instanceof Error
          ? [(error as Error & { operation?: unknown }).operation, error.message.split(":", 1)[0]]
          : [];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && codes.includes(candidate)) return candidate;
    }
  }
  return fallback;
};

/** Resolve structured service failures and leading legacy codes; never search arbitrary diagnostic text. */
export function serviceError(error: unknown, codes: readonly string[], fallback: string): string {
  return declaredCode(failureChain(error), codes, fallback);
}

/** Keep the failing API's diagnostic while removing credentials before it reaches a Worker log. */
export function serviceFailure(error: unknown, codes: readonly string[], fallback: string, secrets: readonly string[]) {
  const chain = failureChain(error);
  const cause = chain[0];
  const redact = (text: string) => {
    for (const secret of secrets) if (secret) text = text.replaceAll(secret, "[redacted]");
    return text
      .replace(/\b(?:Bearer|Basic)\s+[^\s"',;]+/gi, "[redacted]")
      .replace(
        /\b(?:token|secret|password|private[_-]?key|authorization)["']?\s*[:=]\s*["']?[^\s"',;}]+/gi,
        "[redacted]",
      )
      .replace(/0x[0-9a-f]{32,}|\b[A-Za-z0-9_+\/-]{32,}={0,2}\b/gi, "[redacted]");
  };
  return {
    code: declaredCode(chain, codes, fallback),
    type: redact(cause instanceof Error ? cause.constructor.name : typeof cause),
    message: redact(cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "Non-Error failure"),
  };
}

const responseFailureSchema = Schema.Struct({
  error: Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9_]{0,79}$/)),
});

/** A failed service request exposes its status and fixed code, never the response text. */
export async function serviceResponseFailure(
  stage: string,
  response: Pick<Response, "status" | "json">,
): Promise<ServiceResponseFailure> {
  let code = "invalid_service_error";
  try {
    const body = Schema.decodeUnknownResult(responseFailureSchema)(await response.json());
    if (Result.isSuccess(body)) code = body.success.error;
  } catch {
    code = "invalid_service_error";
  }
  const message = `${stage}: HTTP ${response.status}; code ${code}`;
  console.error(message);
  return new ServiceResponseFailure({ stage, status: response.status, code, message });
}
