// The brokering half of the Vercel Sandbox firewall: a `forwardURL` rule sends every sandbox request for a domain to
// us with a Vercel-signed OIDC token, `defineSandboxProxy` verifies it and hands over a sanitized request addressed
// to the original destination, and this module swaps in the real upstream credential and streams the upstream
// response back. M0 runs it inside the probe; M5's agent-service proxy is meant to reuse it unchanged.
import { defineSandboxProxy, type ProxyMeta } from "@vercel/sandbox/proxy";

export interface SandboxProxyRequestLog {
  event: "sandbox_proxy_request";
  sandboxName: string;
  sandboxId: string;
  teamId: string;
  projectId: string;
  host: string;
  method: string;
  path: string;
}

export interface SandboxProxyOptions {
  /** Origin the sanitized request is re-addressed to, e.g. `https://openrouter.ai`. */
  upstreamOrigin: string;
  /** The real bearer credential; the sandbox only ever sends a placeholder. */
  upstreamApiKey: string;
  /**
   * The URL the firewall was told to forward to. `defineSandboxProxy` derives the OIDC audience from the URL the
   * server received, so a proxy behind a tunnel (probe) must restore the public origin before verification. A
   * proxy served directly at its public URL (Vercel function) can omit this.
   */
  publicUrl?: string;
  fetch?: typeof fetch;
  onRequest?: (entry: SandboxProxyRequestLog) => void;
}

export type SandboxProxyFetch = (request: Request) => Promise<Response>;

// Response headers that describe the wire encoding of the upstream body; fetch has already decoded it.
const UPSTREAM_TRANSPORT_HEADERS = ["content-encoding", "content-length", "transfer-encoding"];

export function createSandboxProxyFetch(options: SandboxProxyOptions): SandboxProxyFetch {
  const verifyAndForward = defineSandboxProxy((request, meta) => forwardSandboxRequest(request, meta, options));
  return (request) => verifyAndForward(restorePublicOrigin(request, options.publicUrl));
}

export async function forwardSandboxRequest(
  request: Request,
  meta: ProxyMeta,
  options: SandboxProxyOptions,
): Promise<Response> {
  options.onRequest?.(describeSandboxRequest(request, meta));
  const upstreamRequest = buildUpstreamRequest(request, options);
  const upstream = await (options.fetch ?? fetch)(upstreamRequest);
  return streamUpstreamResponse(upstream);
}

export function buildUpstreamUrl(upstreamOrigin: string, sanitizedRequestUrl: string): string {
  const original = new URL(sanitizedRequestUrl);
  return `${upstreamOrigin.replace(/\/+$/, "")}${original.pathname}${original.search}`;
}

function buildUpstreamHeaders(sandboxHeaders: Headers, upstreamApiKey: string): Headers {
  const headers = new Headers(sandboxHeaders);
  headers.set("authorization", `Bearer ${upstreamApiKey}`);
  headers.delete("host");
  return headers;
}

export function restorePublicOrigin(request: Request, publicUrl: string | undefined): Request {
  if (!publicUrl) return request;
  const restored = new URL(request.url);
  const publicOrigin = new URL(publicUrl);
  // Set hostname and port separately: the URL `host` setter keeps an existing port when the new value has none.
  restored.protocol = publicOrigin.protocol;
  restored.hostname = publicOrigin.hostname;
  restored.port = publicOrigin.port;
  return new Request(restored, request);
}

function describeSandboxRequest(request: Request, meta: ProxyMeta): SandboxProxyRequestLog {
  const url = new URL(request.url);
  return {
    event: "sandbox_proxy_request",
    sandboxName: meta.sandboxName,
    sandboxId: meta.sandboxId,
    teamId: meta.teamId,
    projectId: meta.projectId,
    host: meta.host,
    method: request.method,
    path: `${url.pathname}${url.search}`,
  };
}

function buildUpstreamRequest(request: Request, options: SandboxProxyOptions): Request {
  // Node's fetch requires `duplex` for streamed request bodies; Bun ignores it. bun-types omits it, hence the widening.
  const init: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers: buildUpstreamHeaders(request.headers, options.upstreamApiKey),
    body: request.body,
    duplex: "half",
  };
  return new Request(buildUpstreamUrl(options.upstreamOrigin, request.url), init);
}

function streamUpstreamResponse(upstream: Response): Response {
  const headers = new Headers(upstream.headers);
  for (const name of UPSTREAM_TRANSPORT_HEADERS) headers.delete(name);
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}
