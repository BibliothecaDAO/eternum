/** Return only a service's declared error codes, including errors wrapped by Effect. */
export function serviceError(error: unknown, codes: readonly string[], fallback: string): string {
  if (error instanceof Error && error.cause) {
    const cause = serviceError(error.cause, codes, fallback);
    if (cause !== fallback) return cause;
  }
  const message = error instanceof Error ? error.message : "";
  return codes.find((code) => new RegExp(`(?:^|[:\\s"\\{])${code}(?:$|[:\\s",\\}])`).test(message)) ?? fallback;
}

/** Keep the failing API's diagnostic while removing credentials before it reaches a Worker log. */
export function serviceFailure(error: unknown, codes: readonly string[], fallback: string, secrets: readonly string[]) {
  let cause = error;
  const seen = new Set<unknown>();
  while (cause instanceof Error && cause.cause && !seen.has(cause.cause)) {
    seen.add(cause);
    cause = cause.cause;
  }
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
    code: serviceError(error, codes, fallback),
    type: redact(cause instanceof Error ? cause.constructor.name : typeof cause),
    message: redact(cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "Non-Error failure"),
  };
}

/** A failed service request exposes its status and fixed code, never the response text. */
export async function serviceResponseFailure(
  stage: string,
  response: Pick<Response, "status" | "json">,
): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  const code =
    typeof body?.error === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(body.error) ? body.error : "invalid_service_error";
  const message = `${stage}: HTTP ${response.status}; code ${code}`;
  console.error(message);
  return new Error(message);
}
