#!/usr/bin/env bun
// M0 "firewall brokering" spike (docs/plans/hired-agents-milestones.md). Proves, on our Vercel plan, that a sandbox's
// call to openrouter.ai can be brokered through the firewall: a `forwardURL` rule sends it to a proxy we control, the
// proxy receives a Vercel-signed OIDC token naming the sandbox, injects the real OpenRouter key, and streams the answer
// back with `usage.cost` on the final chunk. The proxy runs in this process; the sandbox reaches it through the public
// URL you pass (a tunnel to the local port, or a deployment of sandbox-proxy-handler.ts).
//
//   cloudflared tunnel --url http://localhost:8787      # prints https://<random>.trycloudflare.com
//   pnpm lab:probe-sandbox-proxy -- --proxy-url https://<random>.trycloudflare.com [--port 8787]
//
// Env: OPENROUTER_API_KEY, plus either VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID or VERCEL_OIDC_TOKEN.
import { Sandbox } from "@vercel/sandbox";
import { createSandboxProxyFetch, type SandboxProxyRequestLog } from "./sandbox-proxy-handler";

const OPENROUTER_ORIGIN = "https://openrouter.ai";
const OPENROUTER_HOST = "openrouter.ai";
const PROBE_MODEL = "openai/gpt-4o-mini";
const SANDBOX_NAME = "probe-sandbox-proxy";
const SANDBOX_TIMEOUT_MS = 5 * 60_000;
const COMMAND_TIMEOUT_MS = 60_000;
const DEFAULT_PROXY_PORT = 8787;
const SANDBOX_RESULT_MARKER = "PROBE_RESULT ";

// Runs inside the sandbox on the universal image's Node. The bearer is a placeholder on purpose: only the proxy holds
// the real key. `usage.include` asks OpenRouter for cost accounting on the (final) chunk.
const SANDBOX_PROBE_SCRIPT = String.raw`
const stream = process.env.PROBE_MODE === "streaming";
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { authorization: "Bearer placeholder", "content-type": "application/json" },
  body: JSON.stringify({
    model: process.env.PROBE_MODEL,
    messages: [{ role: "user", content: "Reply with the single word: pong" }],
    max_tokens: 8,
    stream,
    usage: { include: true },
  }),
});
const text = await response.text();
let result = { status: response.status };
if (!stream) {
  const body = JSON.parse(text);
  result = { ...result, usage: body.usage, body };
} else {
  const chunks = text
    .split("\n")
    .filter((line) => line.startsWith("data: ") && !line.includes("[DONE]"))
    .map((line) => JSON.parse(line.slice(6)));
  const finalChunk = chunks[chunks.length - 1];
  result = { ...result, chunks: chunks.length, usage: finalChunk?.usage, finalChunk };
}
console.log("PROBE_RESULT " + JSON.stringify(result));
process.exit(response.ok ? 0 : 1);
`;

interface ProbeArgs {
  proxyUrl: string;
  port: number;
}

interface VercelCredentials {
  token: string;
  teamId: string;
  projectId: string;
}

interface ProbeRequestResult {
  mode: "streaming" | "nonStreaming";
  ok: boolean;
  status: number | null;
  usageCost: number | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

interface SandboxProbeOutput {
  status: number;
  usage?: { cost?: number };
  chunks?: number;
  finalChunk?: unknown;
  body?: unknown;
}

const args = parseProbeArgs(process.argv.slice(2));
const credentials = resolveVercelCredentials();
const openRouterApiKey = requireOpenRouterApiKey();

const observedRequests: SandboxProxyRequestLog[] = [];
const proxy = startProxy(args, openRouterApiKey, observedRequests);
console.log(JSON.stringify({ event: "proxy_listening", port: args.port, publicUrl: args.proxyUrl }));

const sandbox = await createProbeSandbox(args.proxyUrl, credentials);
try {
  const streaming = await runProbeInSandbox(sandbox, "streaming");
  const nonStreaming = await runProbeInSandbox(sandbox, "nonStreaming");
  const healthy = printManifest({ streaming, nonStreaming, observedRequests });
  process.exitCode = healthy ? 0 : 1;
} finally {
  await sandbox.stop();
  proxy.stop(true);
}

function parseProbeArgs(argv: string[]): ProbeArgs {
  let proxyUrl: string | undefined;
  let port = DEFAULT_PROXY_PORT;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--proxy-url") proxyUrl = argv[++index];
    else if (argv[index] === "--port") port = Number(argv[++index]);
  }
  if (!proxyUrl || !/^https:\/\//.test(proxyUrl) || !Number.isInteger(port)) exitWithUsage();
  return { proxyUrl: proxyUrl.replace(/\/+$/, ""), port };
}

function exitWithUsage(): never {
  console.error(
    [
      "usage: pnpm lab:probe-sandbox-proxy -- --proxy-url https://<public-host> [--port 8787]",
      "",
      "The sandbox must reach the proxy this script starts, and forwardURL must be https, so expose the port first:",
      "  cloudflared tunnel --url http://localhost:8787     (or: ngrok http 8787)",
      "then pass the printed https URL as --proxy-url.",
    ].join("\n"),
  );
  process.exit(2);
}

// The SDK only reads VERCEL_OIDC_TOKEN from the environment; an access token must be passed explicitly.
function resolveVercelCredentials(): VercelCredentials | undefined {
  const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID, VERCEL_OIDC_TOKEN } = process.env;
  if (VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID) {
    return { token: VERCEL_TOKEN, teamId: VERCEL_TEAM_ID, projectId: VERCEL_PROJECT_ID };
  }
  if (VERCEL_OIDC_TOKEN) return undefined;
  console.error(
    [
      "Missing Vercel credentials. Set either",
      "  VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID   (access token scoped to the sandbox project), or",
      "  VERCEL_OIDC_TOKEN                                   (from `npx vercel link && npx vercel env pull`).",
    ].join("\n"),
  );
  process.exit(2);
}

function requireOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (key) return key;
  console.error("Missing OPENROUTER_API_KEY: the proxy injects it in place of the sandbox's placeholder bearer.");
  process.exit(2);
}

function startProxy(probeArgs: ProbeArgs, upstreamApiKey: string, sink: SandboxProxyRequestLog[]) {
  return Bun.serve({
    port: probeArgs.port,
    fetch: createSandboxProxyFetch({
      upstreamOrigin: OPENROUTER_ORIGIN,
      upstreamApiKey,
      publicUrl: probeArgs.proxyUrl,
      onRequest: (entry) => {
        sink.push(entry);
        console.log(JSON.stringify(entry));
      },
    }),
  });
}

async function createProbeSandbox(proxyUrl: string, vercel: VercelCredentials | undefined): Promise<Sandbox> {
  const params = {
    name: SANDBOX_NAME,
    persistent: false,
    timeout: SANDBOX_TIMEOUT_MS,
    networkPolicy: { allow: { [OPENROUTER_HOST]: [{ forwardURL: proxyUrl }] } },
  };
  try {
    const sandbox = await Sandbox.create(vercel ? { ...params, ...vercel } : params);
    console.log(JSON.stringify({ event: "sandbox_created", name: sandbox.name }));
    return sandbox;
  } catch (error) {
    // A plan without firewall proxying rejects the policy at creation; that is the M0 fallback signal (brief §7).
    console.log(
      JSON.stringify({ event: "sandbox_proxy_probe", forwardUrlSupported: false, error: describeError(error) }),
    );
    process.exit(1);
  }
}

async function runProbeInSandbox(sandbox: Sandbox, mode: ProbeRequestResult["mode"]): Promise<ProbeRequestResult> {
  const finished = await sandbox.runCommand({
    cmd: "node",
    args: ["--input-type=module", "-e", SANDBOX_PROBE_SCRIPT],
    env: { PROBE_MODE: mode, PROBE_MODEL },
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  const [stdout, stderr] = await Promise.all([finished.stdout(), finished.stderr()]);
  console.log(JSON.stringify({ event: "sandbox_command", mode, exitCode: finished.exitCode }));
  if (stdout) console.log(`--- sandbox stdout (${mode}) ---\n${stdout.trimEnd()}`);
  if (stderr) console.log(`--- sandbox stderr (${mode}) ---\n${stderr.trimEnd()}`);
  const output = parseSandboxProbeOutput(stdout);
  return {
    mode,
    ok: finished.exitCode === 0 && output?.status === 200 && typeof output.usage?.cost === "number",
    status: output?.status ?? null,
    usageCost: output?.usage?.cost ?? null,
    exitCode: finished.exitCode,
    stdout,
    stderr,
  };
}

function parseSandboxProbeOutput(stdout: string): SandboxProbeOutput | undefined {
  const line = stdout
    .split("\n")
    .reverse()
    .find((candidate) => candidate.startsWith(SANDBOX_RESULT_MARKER));
  if (!line) return undefined;
  try {
    return JSON.parse(line.slice(SANDBOX_RESULT_MARKER.length)) as SandboxProbeOutput;
  } catch {
    return undefined;
  }
}

function printManifest(input: {
  streaming: ProbeRequestResult;
  nonStreaming: ProbeRequestResult;
  observedRequests: SandboxProxyRequestLog[];
}): boolean {
  const first = input.observedRequests[0];
  const oidcClaims = first
    ? { sandboxName: first.sandboxName, sandboxId: first.sandboxId, teamId: first.teamId, projectId: first.projectId }
    : null;
  const manifest = {
    event: "sandbox_proxy_probe",
    forwardUrlSupported: input.observedRequests.length > 0,
    oidcClaims,
    proxiedRequests: input.observedRequests.length,
    streaming: summarize(input.streaming),
    nonStreaming: summarize(input.nonStreaming),
    exitCodes: { streaming: input.streaming.exitCode, nonStreaming: input.nonStreaming.exitCode },
  };
  console.log(JSON.stringify(manifest));
  return manifest.forwardUrlSupported && input.streaming.ok && input.nonStreaming.ok;
}

function summarize(result: ProbeRequestResult) {
  return { ok: result.ok, status: result.status, usageCost: result.usageCost };
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
