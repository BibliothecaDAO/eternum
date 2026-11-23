export async function nodeRpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method}: node RPC HTTP ${response.status}`);
  return response.json();
}
