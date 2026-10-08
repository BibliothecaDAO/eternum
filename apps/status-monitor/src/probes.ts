import type { Probe, Status, Target } from "./model";

const PLAY = "https://play.realms.party";
const DEADLINE_MS = 5000;
const SLOW_MS = 1000;
const HEX = /^0x[0-9a-fA-F]{1,64}$/;
type Reader = ReturnType<typeof publicReader>;

/** Probe the public paths a browser relies on. Discovery failure retains worlds rather than erasing their rows. */
export async function probeServices(network: typeof fetch, now: number, known: Target[]) {
  let targets = known;
  let directoryReadable = false;
  const [play, accounts, directory, blitz, chat] = await Promise.all([
    measure("play", "Play", network, probePlay),
    measure("accounts", "Sign in and accounts", network, probeAccounts),
    measure("directory", "Games list", network, async (read) => {
      const listing = await readDirectory(read);
      targets = listing.targets;
      directoryReadable = true;
      return listing.available ? "up" : "down";
    }),
    measure("blitz", "Blitz lobbies", network, probeSlots),
    measure("chat", "Chat", network, probeChat),
  ]);
  const worlds = await Promise.all(targets.map((target) => probeWorld(target, network, now)));
  if (directoryReadable && worlds.some((world) => world.status === "down")) {
    directory.status = "down";
    directory.latency_ms = null;
  } else if (directoryReadable && worlds.some((world) => world.status === "degraded")) directory.status = "degraded";
  return { targets, probes: [play, accounts, directory, blitz, chat, ...worlds] };
}

async function probePlay(read: Reader): Promise<Status> {
  const html = await (await read(PLAY + "/")).text();
  const script = [...html.matchAll(/<script\b([^>]*)>/gi)].find((tag) => /\btype\s*=\s*(["'])module\1/i.test(tag[1]!));
  const path = script?.[1]?.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
  if (!path) throw new Error("Module missing");
  const url = publicUrl(new URL(path, PLAY).href);
  if (url.origin !== PLAY) throw new Error("Module origin mismatch");
  const module = await read(url.href);
  if (!/javascript|ecmascript/i.test(module.headers.get("content-type") ?? "")) throw new Error("Invalid module type");
  if (!(await module.text()).trim()) throw new Error("Empty module");
  return "up";
}

async function probeAccounts(read: Reader): Promise<Status> {
  requireReady(await body(read, PLAY + "/api/health/accounts"));
  const guardian = await body(read, PLAY + "/api/guardian");
  if (!felt(guardian.publicKey) || !felt(guardian.accountClassHash)) throw new Error("Guardian unavailable");
  return "up";
}

async function readDirectory(read: Reader) {
  const directory = await body(read, PLAY + "/api/directory");
  if (!Array.isArray(directory.shards)) throw new Error("Directory missing");
  const targets = directory.shards.map(parseTarget);
  const available = directory.shards.every(
    (shard: { games?: unknown; error?: unknown }) =>
      Array.isArray(shard.games) &&
      !shard.error &&
      shard.games.every((game: unknown) => game && typeof game === "object" && !("error" in game)),
  );
  return { targets, available };
}

async function probeSlots(read: Reader): Promise<Status> {
  const slots = await body(read, PLAY + "/api/slots");
  if (!Array.isArray(slots.slots)) throw new Error("Slots missing");
  return "up";
}

async function probeChat(read: Reader): Promise<Status> {
  requireReady(await body(read, PLAY + "/api/chat/health"));
  return "up";
}

function probeWorld(target: Target, network: typeof fetch, now: number) {
  return measure(`shard:${target.chainId}`, new URL(target.url).hostname, network, async (read) => {
    const [manifest, health] = await Promise.all([
      body(read, target.url + "/manifest"),
      body(read, target.url + "/health"),
    ]);
    if (!felt(manifest.chainId) || BigInt(manifest.chainId as string) !== BigInt(target.chainId))
      throw new Error("Chain mismatch");
    requireReady(health);
    if (health.undecodable_events !== 0 || !height(health.confirmed_block)) throw new Error("Herald incomplete");
    await gatewayListening(read, publicUrl(manifest.admissionUrl).href);
    const rpc = publicUrl(manifest.rpcUrl);
    const latest = await nodeHeader(read, rpc.href, "latest");
    const heraldHeight = health.confirmed_block as number;
    const confirmed =
      heraldHeight === latest.block_number ? latest : await nodeHeader(read, rpc.href, { block_number: heraldHeight });
    const lag = latest.block_number - heraldHeight;
    const age = Math.max(now - latest.timestamp, now - confirmed.timestamp);
    if (lag < 0 || latest.timestamp > now + 30 || confirmed.timestamp > now + 30) throw new Error("Invalid head clock");
    return age > 120 || lag > 10 ? "down" : age > 30 || lag > 2 ? "degraded" : "up";
  });
}

async function measure(
  id: string,
  name: string,
  network: typeof fetch,
  probe: (read: Reader) => Promise<Status>,
): Promise<Probe> {
  const start = performance.now();
  try {
    const signal = AbortSignal.timeout(DEADLINE_MS);
    const status = await probe(publicReader(network, signal));
    signal.throwIfAborted();
    const latency = Math.round(performance.now() - start);
    return {
      id,
      name,
      status: status === "up" && latency > SLOW_MS ? "degraded" : status,
      latency_ms: status === "down" ? null : latency,
    };
  } catch {
    return { id, name, status: "down", latency_ms: null };
  }
}

function publicReader(network: typeof fetch, signal: AbortSignal) {
  return async (url: string, init?: RequestInit) => {
    publicUrl(url);
    const response = await network(url, { ...init, signal, redirect: "manual", cache: "no-store" });
    if (!response.ok) throw new Error("Public probe failed");
    return response;
  };
}

async function body(read: Reader, url: string): Promise<Record<string, unknown>> {
  const value = await (await read(url)).json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid public JSON");
  return value as Record<string, unknown>;
}
function requireReady(value: Record<string, unknown>) {
  if (value.success !== true) throw new Error("Not ready");
}
function parseTarget(value: unknown): Target {
  const target = value as Target;
  if (!target || !felt(target.chainId) || !["active", "draining"].includes(target.status))
    throw new Error("Invalid shard target");
  const url = publicUrl(target.url);
  return {
    url: url.href.replace(/\/$/, ""),
    chainId: `0x${BigInt(target.chainId).toString(16)}`,
    status: target.status,
  };
}
function publicUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("Public URL missing");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port ||
    url.hostname === "localhost" ||
    !url.hostname.includes(".") ||
    url.hostname.endsWith(".local") ||
    /^[\d.:\[\]]+$/.test(url.hostname)
  )
    throw new Error("Public HTTPS URL required");
  return url;
}
const felt = (value: unknown): value is string => typeof value === "string" && HEX.test(value) && BigInt(value) > 0n;
const height = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
async function nodeHeader(read: Reader, url: string, block: "latest" | { block_number: number }) {
  const response = await read(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_getBlockWithTxHashes",
      params: { block_id: block },
    }),
  });
  const payload = (await response.json()) as {
    id?: unknown;
    result?: { block_number?: unknown; timestamp?: unknown };
    error?: unknown;
  };
  if (payload.id !== 1 || payload.error || !height(payload.result?.block_number) || !height(payload.result?.timestamp))
    throw new Error("Node head unavailable");
  if (block !== "latest" && payload.result.block_number !== block.block_number) throw new Error("Wrong Herald head");
  return { block_number: payload.result.block_number, timestamp: payload.result.timestamp };
}

async function gatewayListening(read: Reader, url: string) {
  // An unknown method cannot enqueue an action. This checks the public listener, not successful sequencing.
  const response = await read(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "realms_status_probe", params: [] }),
  });
  const payload = (await response.json()) as { id?: unknown; error?: { code?: unknown } };
  if (payload.id !== 1 || payload.error?.code !== -32601) throw new Error("Admission listener unavailable");
}
