/** Report failure categories without serializing RPC requests, credentials or error payloads. */
export function publicSetupFailure(error: unknown) {
  const causes: { kind: string; code: number | null; approvalStatus: number | null; hints: string[] }[] = [];
  const seen = new Set<unknown>();
  while (error && typeof error === "object" && !seen.has(error) && causes.length < 8) {
    seen.add(error);
    const value = error as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown };
    const message = typeof value.message === "string" ? value.message : "";
    const status = /refused:\s*(\d{3})\b/.exec(message)?.[1];
    causes.push({
      kind: ["Error", "TypeError", "AbortError", "TimeoutError", "RpcError"].includes(String(value.name))
        ? String(value.name)
        : "unknown",
      code:
        typeof value.code === "number" && Number.isInteger(value.code) && Math.abs(value.code) < 100000
          ? value.code
          : null,
      approvalStatus: status ? Number(status) : null,
      hints: ["nonce", "signature", "approval", "timeout", "ECONNREFUSED"].filter((hint) =>
        message.toLowerCase().includes(hint.toLowerCase()),
      ),
    });
    error = value.cause;
  }
  return { phase: "account setup failed", causes };
}
