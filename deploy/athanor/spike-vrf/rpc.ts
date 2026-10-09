export class RpcRefusal extends Error {
  constructor(readonly code: number) {
    super("Spike RPC refused request");
  }
}
/** Error replies are deliberately fixed: reveal calldata can contain an epoch secret. */
export async function rpc(url: string, method: string, params: unknown): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(30000),
    redirect: "manual",
  });
  if (!response.ok) throw new Error("Spike RPC unavailable");
  const body = (await response.json()) as { result?: unknown; error?: { code?: number } };
  if (body.error && Number.isInteger(body.error.code)) throw new RpcRefusal(body.error.code!);
  if (body.error || body.result === undefined) throw new Error("Spike RPC invalid reply");
  return body.result;
}
