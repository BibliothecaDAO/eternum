import { isIP } from "node:net";

function address(value: string): string | undefined {
  if (!isIP(value)) return undefined;
  return isIP(value) === 6 ? new URL(`http://[${value}]`).hostname.slice(1, -1) : value;
}

export function rpcClientAddress(peer: string, trustedProxy: string | undefined, headers: Headers): string {
  const socket = address(peer) ?? peer;
  if (!trustedProxy || socket !== address(trustedProxy)) return socket;
  const last = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return (last && address(last)) || socket;
}

// The proxy replaces the unrestricted public write path. Bound its account-operation allowance per tunnel client.
export function accountRequestLimiter() {
  const windows = new Map<string, { start: number; count: number }>();
  return (client: string, count: number): boolean => {
    const now = Date.now();
    for (const [key, window] of windows) if (now - window.start >= 60000) windows.delete(key);
    if (!windows.has(client) && windows.size >= 4096) return false;
    const window = windows.get(client) ?? { start: now, count: 0 };
    windows.set(client, window);
    window.count += count;
    return window.count <= 30;
  };
}
