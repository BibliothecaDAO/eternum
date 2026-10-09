interface Env {
  IDENTITY: Fetcher;
  ASSETS: Fetcher;
  LAUNCH: Fetcher;
  RELAY: Fetcher;
  MONITOR: Fetcher;
  GUARDIAN: Fetcher;
  SHARD_HERALD_URL: string;
  SHARD_RPC_URL: string;
  LEDGER_RPC_URL: string;
  LOCAL_VALUE: string;
}
export default {
  fetch(request: Request, env: Env) {
    const { pathname, search } = new URL(request.url);
    if (pathname === "/local-value.json" && !env.LOCAL_VALUE) return new Response(null, { status: 503 });
    if (pathname === "/local-value.json")
      return new Response(env.LOCAL_VALUE, {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    if (pathname === "/l2/rpc") return fetch(new Request(env.LEDGER_RPC_URL, request));
    if (pathname === "/rpc" || pathname.startsWith("/rpc/")) return fetch(new Request(env.SHARD_RPC_URL, request));
    if (pathname === "/health" || pathname === "/manifest" || pathname === "/games" || pathname.startsWith("/games/"))
      return fetch(new Request(new URL(pathname + search, env.SHARD_HERALD_URL), request));
    if (pathname === "/health/guardian")
      return env.GUARDIAN.fetch(new Request(new URL("/health", request.url), request));
    if (pathname === "/health/relay") return env.RELAY.fetch(new Request(new URL("/health", request.url), request));
    if (pathname === "/health/monitor") return env.MONITOR.fetch(new Request(new URL("/health", request.url), request));
    if (pathname.startsWith("/api/value/")) return env.RELAY.fetch(request);
    if (pathname.startsWith("/api/operator/monitor/")) return env.MONITOR.fetch(request);
    if (pathname.startsWith("/api/factory/") || pathname.startsWith("/api/slots")) return env.LAUNCH.fetch(request);
    if (pathname.startsWith("/api/")) return env.IDENTITY.fetch(request);
    return env.ASSETS.fetch(request);
  },
};
