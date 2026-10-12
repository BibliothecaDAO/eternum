/** Return only a service's declared error codes, including errors wrapped by Effect. */
export function serviceError(error: unknown, codes: readonly string[], fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return codes.find((code) => new RegExp(`(?:^|[:\\s"\\{])${code}(?:$|[\\s",\\}])`).test(message)) ?? fallback;
}
