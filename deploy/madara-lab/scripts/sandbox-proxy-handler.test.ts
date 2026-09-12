import { describe, expect, it } from "bun:test";
import type { ProxyMeta } from "@vercel/sandbox/proxy";
import {
  buildUpstreamUrl,
  createSandboxProxyFetch,
  forwardSandboxRequest,
  restorePublicOrigin,
  type SandboxProxyRequestLog,
} from "./sandbox-proxy-handler";

const UPSTREAM_ORIGIN = "https://openrouter.ai";
const REAL_KEY = "sk-or-real";
const SANDBOX_META: ProxyMeta = {
  host: "openrouter.ai",
  teamId: "team_1",
  projectId: "prj_1",
  sandboxId: "sbx_1",
  sandboxName: "probe-sandbox-proxy",
};

interface FakeUpstream {
  fetch: typeof fetch;
  calls: Request[];
}

// Upstream answers with a two-chunk SSE stream whose transport headers describe an encoding fetch already removed.
function createFakeUpstream(chunks: string[]): FakeUpstream {
  const calls: Request[] = [];
  const fakeFetch = (async (input: RequestInfo | URL) => {
    calls.push(input as Request);
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream", "content-encoding": "br", "content-length": "999" },
    });
  }) as typeof fetch;
  return { fetch: fakeFetch, calls };
}

// What `defineSandboxProxy` hands the handler: the original destination, forwarded headers already stripped.
function createSanitizedSandboxRequest(): Request {
  return new Request("https://openrouter.ai:443/api/v1/chat/completions?probe=1", {
    method: "POST",
    headers: { authorization: "Bearer placeholder", "content-type": "application/json", host: "openrouter.ai" },
    body: JSON.stringify({ stream: true }),
  });
}

// What the firewall sends the proxy: the request re-addressed to forwardURL plus the vercel-forwarded-* envelope.
function createFirewallEnvelope(oidcToken: string | undefined): Request {
  const headers: Record<string, string> = {
    "vercel-forwarded-host": "openrouter.ai",
    "vercel-forwarded-scheme": "https",
    "vercel-forwarded-port": "443",
    "vercel-forwarded-path": "/api/v1/chat/completions",
    authorization: "Bearer placeholder",
  };
  if (oidcToken) headers["vercel-sandbox-oidc-token"] = oidcToken;
  return new Request("http://localhost:8787/api/v1/chat/completions", { method: "POST", headers, body: "{}" });
}

function encodeUnsignedJwt(payload: Record<string, unknown>): string {
  const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${segment({ alg: "RS256", typ: "JWT" })}.${segment(payload)}.signature`;
}

describe("sandbox proxy handler", () => {
  it("re-addresses the sandbox request to the upstream origin and swaps the placeholder bearer", async () => {
    const upstream = createFakeUpstream(["data: {}\n\n"]);
    const seen: SandboxProxyRequestLog[] = [];
    await forwardSandboxRequest(createSanitizedSandboxRequest(), SANDBOX_META, {
      upstreamOrigin: UPSTREAM_ORIGIN,
      upstreamApiKey: REAL_KEY,
      fetch: upstream.fetch,
      onRequest: (entry) => seen.push(entry),
    });

    const forwarded = upstream.calls[0]!;
    expect(forwarded.url).toBe("https://openrouter.ai/api/v1/chat/completions?probe=1");
    expect(forwarded.method).toBe("POST");
    expect(forwarded.headers.get("authorization")).toBe(`Bearer ${REAL_KEY}`);
    expect(forwarded.headers.get("content-type")).toBe("application/json");
    expect(forwarded.headers.get("host")).toBeNull();
    expect(await forwarded.text()).toBe(JSON.stringify({ stream: true }));
    expect(seen).toEqual([
      {
        event: "sandbox_proxy_request",
        sandboxName: "probe-sandbox-proxy",
        sandboxId: "sbx_1",
        teamId: "team_1",
        projectId: "prj_1",
        host: "openrouter.ai",
        method: "POST",
        path: "/api/v1/chat/completions?probe=1",
      },
    ]);
  });

  it("streams the upstream body back without the stale transport headers", async () => {
    const chunks = ['data: {"choices":[]}\n\n', 'data: {"usage":{"cost":0.00001}}\n\ndata: [DONE]\n\n'];
    const upstream = createFakeUpstream(chunks);
    const response = await forwardSandboxRequest(createSanitizedSandboxRequest(), SANDBOX_META, {
      upstreamOrigin: UPSTREAM_ORIGIN,
      upstreamApiKey: REAL_KEY,
      fetch: upstream.fetch,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(await response.text()).toBe(chunks.join(""));
  });

  it("builds the upstream URL from the sanitized request path and query", () => {
    expect(buildUpstreamUrl("https://openrouter.ai/", "https://openrouter.ai:443/api/v1/models?x=1")).toBe(
      "https://openrouter.ai/api/v1/models?x=1",
    );
    expect(buildUpstreamUrl("https://openrouter.ai", "https://openrouter.ai:443/")).toBe("https://openrouter.ai/");
  });

  it("restores the public origin a tunnel hid so the OIDC audience check sees forwardURL", async () => {
    const restored = restorePublicOrigin(createFirewallEnvelope("token"), "https://probe.example/");
    expect(restored.url).toBe("https://probe.example/api/v1/chat/completions");
    expect(restored.method).toBe("POST");
    expect(restored.headers.get("vercel-forwarded-host")).toBe("openrouter.ai");
    expect(await restored.text()).toBe("{}");
    expect(restorePublicOrigin(createFirewallEnvelope("token"), undefined).url).toBe(
      "http://localhost:8787/api/v1/chat/completions",
    );
  });

  it("rejects firewall envelopes without a verifiable sandbox token before touching upstream", async () => {
    const upstream = createFakeUpstream([]);
    const proxy = createSandboxProxyFetch({
      upstreamOrigin: UPSTREAM_ORIGIN,
      upstreamApiKey: REAL_KEY,
      publicUrl: "https://probe.example",
      fetch: upstream.fetch,
    });

    const missingToken = await proxy(createFirewallEnvelope(undefined));
    const foreignIssuer = await proxy(createFirewallEnvelope(encodeUnsignedJwt({ iss: "https://not-vercel.example" })));

    expect(missingToken.status).toBe(403);
    expect(foreignIssuer.status).toBe(403);
    expect(upstream.calls).toHaveLength(0);
  });
});
