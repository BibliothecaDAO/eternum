/**
 * A fixed-window request budget per client, for the public read endpoints. The client is the address the edge
 * hands us (Cloudflare, then any proxy), else the socket; unknown clients share one budget.
 */
interface RateLimitOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

interface WindowCount {
  windowStartedAt: number;
  count: number;
}

export const createRateLimiter = ({ limit, windowMs, now = Date.now }: RateLimitOptions) => {
  const counts = new Map<string, WindowCount>();

  const prune = (at: number) => {
    counts.forEach((entry, key) => {
      if (at - entry.windowStartedAt >= windowMs) counts.delete(key);
    });
  };

  return {
    /** True when the client still has budget in the current window; the request is counted either way. */
    allow(client: string): boolean {
      const at = now();
      if (counts.size > 10_000) prune(at);
      const entry = counts.get(client);
      if (!entry || at - entry.windowStartedAt >= windowMs) {
        counts.set(client, { windowStartedAt: at, count: 1 });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
  };
};

export const clientAddressOf = (request: Request, socketAddress: string | null | undefined): string =>
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  socketAddress ??
  "unknown";
