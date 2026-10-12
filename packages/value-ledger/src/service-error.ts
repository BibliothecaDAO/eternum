/** Return only a service's declared error codes, including errors wrapped by Effect. */
export function serviceError(error: unknown, codes: readonly string[], fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return codes.find((code) => new RegExp(`(?:^|[:\\s"\\{])${code}(?:$|[\\s",\\}])`).test(message)) ?? fallback;
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
