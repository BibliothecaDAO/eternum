import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import * as chain from "@realms-world/chain";
import { expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";
import worker, { monitor } from "./worker";
import { probeServices } from "./probes";
import { nextMonitorState } from "./state";
import type { MonitorState } from "./model";
import { DAILY_EMAILS, NOTICE_LIFETIME_SECONDS, NO_ALERTS, recordNotices, SUSTAINED_SECONDS } from "./alerts";
import { onRequestGet } from "../../status/functions/status.json";

const now = 1791456000;
const world = { url: "https://shard.public.test", chainId: "0xa", status: "active" };
const valueTargets = {
  playUrl: "https://play.realms.party",
  ledgerRpcUrl: "https://ledger-rpc.public.test",
  ledgerAddress: "0x123",
};
const response = (value: unknown) => Response.json(value);
const network =
  (overrides: Record<string, Response> = {}) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/\/$/, "");
    if (overrides[url]) return overrides[url]!.clone();
    if (url === valueTargets.playUrl + "/api/guardian") return response({ publicKey: "0x1", accountClassHash: "0x2" });
    if (url === valueTargets.playUrl + "/api/value/health")
      return response({ service: "value-relay", success: true, checked_at: now });
    if (url === valueTargets.playUrl + "/api/operator/monitor/health")
      return response({ service: "value-monitor", success: true, checked_at: now });
    if (url === valueTargets.ledgerRpcUrl) {
      const rpc = JSON.parse(String(init?.body));
      return response({
        jsonrpc: "2.0",
        id: rpc.id,
        result: rpc.method === "starknet_call" ? ["0x0"] : { block_number: 10, timestamp: now },
      });
    }
    if (url.endsWith("/api/directory")) return response({ shards: [{ ...world, games: [] }] });
    if (url.endsWith("/api/slots")) return response({ slots: [] });
    if (url.endsWith("/api/factory/health"))
      return response({ service: "launch", failedRuns: [], joinFailures: [], freezeFailures: [], strandedRuns: [] });
    if (url.endsWith("/api/guardian")) return response({ publicKey: "0x1", accountClassHash: "0x2" });
    if (url.endsWith("/api/health/accounts") || url.endsWith("/api/chat/health")) return response({ success: true });
    if (url.endsWith("/manifest"))
      return response({
        chainId: "0xa",
        rpcUrl: "https://rpc.public.test",
      });
    if (url.endsWith("/health"))
      return response({
        service: "herald",
        success: true,
        confirmed_block: 10,
        undecodable_events: 0,
        node: { sampled_at: now, memory_bytes: 2e9, host_memory_bytes: 96e9 },
      });
    if (url === "https://rpc.public.test") {
      const rpc = JSON.parse(String(init?.body));
      return response({ jsonrpc: "2.0", id: rpc.id, result: { block_number: 10, timestamp: now } });
    }
    if (url.endsWith("/main.js")) return new Response("export {};", { headers: { "content-type": "text/javascript" } });
    return new Response('<script type="module" src="/main.js"></script>');
  };

it("probes every public path and world, not merely a directory200", async () => {
  const result = await probeServices(network(), now, [], valueTargets);
  expect(result.probes.map((p) => [p.id, p.status])).toEqual([
    ["play", "up"],
    ["accounts", "up"],
    ["directory", "up"],
    ["blitz", "up"],
    ["launch", "up"],
    ["chat", "up"],
    ["guardian", "up"],
    ["relay", "up"],
    ["monitor", "up"],
    ["ledger", "up"],
    ["shard:0xa", "up"],
    ["node:0xa", "up"],
  ]);
  const failed = await probeServices(
    network({ "https://shard.public.test/health": new Response(null, { status: 503 }) }),
    now,
    [],
    valueTargets,
  );
  expect(failed.probes.find((p) => p.id === "directory")!.status).toBe("down");
  expect(failed.probes.find((p) => p.id === "shard:0xa")!.latency_ms).toBeNull();
});

it("keeps worlds visible when discovery fails and rejects inaccessible or malformed services", async () => {
  const result = await probeServices(
    network({
      "https://play.realms.party/api/directory": new Response(null, { status: 503 }),
      "https://play.realms.party/api/slots": response({}),
      "https://play.realms.party/api/chat/health": response({ success: false }),
    }),
    now,
    [world],
    valueTargets,
  );
  expect(result.probes.find((p) => p.id === "shard:0xa")!.status).toBe("up");
  for (const id of ["directory", "blitz", "chat"]) expect(result.probes.find((p) => p.id === id)!.status).toBe("down");
});

it("classifies head age and lag, invalid clocks and malformed module responses", async () => {
  for (const [age, status] of [
    [31, "degraded"],
    [121, "down"],
    [-31, "down"],
  ] as const) {
    const result = await probeServices(
      network({
        "https://rpc.public.test": response({
          jsonrpc: "2.0",
          id: 1,
          result: { block_number: 10, timestamp: now - age },
        }),
      }),
      now,
      [],
      valueTargets,
    );
    expect(result.probes.find((p) => p.id === "shard:0xa")!.status).toBe(status);
  }
  const html = await probeServices(
    network({
      "https://play.realms.party/main.js": new Response("<html/>", { headers: { "content-type": "text/html" } }),
    }),
    now,
    [],
    valueTargets,
  );
  expect(html.probes[0]!.status).toBe("down");
});

it("counts a minute once, resets continuity across missing runs, and leaves gaps unknown", () => {
  const probes = [{ id: "play", name: "Play", status: "up" as const, latency_ms: 5 }];
  const first = nextMonitorState(null, now, probes, []);
  const repeated = nextMonitorState(first, now + 1, probes, []);
  expect(repeated).toBeNull();
  const next = nextMonitorState(first, now + 180, probes, [])!;
  expect(next.document.components[0]!.since).toBe(now + 180);
  expect(next.document.components[0]!.days).toHaveLength(90);
  expect(next.document.components[0]!.days.at(-1)!.uptime).toBeNull();
});

it("records observed incidents, resolves them only on recovery, and retains bounded history", () => {
  const down = [{ id: "chat", name: "Chat", status: "down" as const, latency_ms: null }];
  const first = nextMonitorState(null, now, down, [])!;
  expect(first.document.incidents[0]!.status).toBe("monitoring");
  const next = nextMonitorState(first, now + 60, [{ ...down[0]!, status: "up", latency_ms: 10 }], [])!;
  expect(next.document.incidents[0]).toMatchObject({ status: "resolved", resolved_at: now + 60 });
});

it("serves no-store JSON independently, and refuses old green or missing documents", async () => {
  let state = nextMonitorState(
    null,
    Math.floor(Date.now() / 1000),
    [{ id: "play", name: "Play", status: "up", latency_ms: 1 }],
    [],
  )!;
  const env = { STATUS_BUCKET: { get: async () => ({ json: async () => state }) } };
  const read = () => onRequestGet({ env } as unknown as Parameters<typeof onRequestGet>[0]);
  let result = await read();
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(await result.json()).toEqual(state.document);
  state = nextMonitorState(
    null,
    Math.floor(Date.now() / 1000) - 301,
    [{ id: "play", name: "Play", status: "up", latency_ms: 1 }],
    [],
  )!;
  result = await read();
  expect(result.status).toBe(503);
  expect(await result.json()).toMatchObject({ error: "status_stale", checked_at: state.document.checked_at });
  expect(result.headers.get("cache-control")).toBe("no-store");
});

it("publishes atomically on local R2 and rejects an overlapping late writer", async () => {
  const mf = new Miniflare({
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
    r2Buckets: ["STATUS_BUCKET"],
    compatibilityDate: "2026-07-30",
  });
  try {
    const bucket = (await mf.getR2Bucket("STATUS_BUCKET")) as unknown as R2Bucket;
    await monitor(bucket, network(), now, valueTargets);
    const original = await bucket.get("state.json");
    expect(original).not.toBeNull();
    let unblock!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const slow: typeof fetch = async (input, init) => {
      if (String(input).endsWith("/api/directory")) {
        started();
        await gate;
      }
      return network()(input, init);
    };
    const late = monitor(bucket, slow, now + 60, valueTargets);
    await entered;
    await monitor(bucket, network(), now + 120, valueTargets);
    unblock();
    await expect(late).rejects.toThrow("superseded");
    const published = await (await bucket.get("state.json"))!.json<{ document: { checked_at: number } }>();
    expect(published.document.checked_at).toBe(now + 120);
    const etag = (await bucket.get("state.json"))!.etag;
    await monitor(bucket, network(), now + 120, valueTargets);
    expect((await bucket.get("state.json"))!.etag).toBe(etag);
  } finally {
    await disposeWorker(mf);
  }
});

it("marks a slow successful read degraded and a timed-out read down", async () => {
  const clock = vi.spyOn(performance, "now");
  let tick = 0;
  clock.mockImplementation(() => {
    tick += 1100;
    return tick;
  });
  const slow = await probeServices(network(), now, [], valueTargets);
  expect(slow.probes[0]!.status).toBe("degraded");
  clock.mockRestore();
  const timeout: typeof fetch = async (input, init) => {
    if (String(input).endsWith("/api/chat/health")) throw new Error("timed out");
    return network()(input, init);
  };
  expect((await probeServices(timeout, now, [], valueTargets)).probes.find((p) => p.id === "chat")!.status).toBe(
    "down",
  );
});

it("rejects future clocks and unavailable storage at the static read", async () => {
  const future = nextMonitorState(
    null,
    Math.floor(Date.now() / 1000) + 61,
    [{ id: "play", name: "Play", status: "up", latency_ms: 1 }],
    [],
  )!;
  const read = (get: () => Promise<unknown>) =>
    onRequestGet({ env: { STATUS_BUCKET: { get } } } as unknown as Parameters<typeof onRequestGet>[0]);
  expect((await read(async () => ({ json: async () => future }))).status).toBe(503);
  expect((await read(async () => null)).status).toBe(503);
  expect(
    (
      await read(async () => {
        throw new Error("R2 unavailable");
      })
    ).status,
  ).toBe(503);
});

it("does not mark a world healthy when its RPC listener is unreachable", async () => {
  const result = await probeServices(
    network({ "https://rpc.public.test": new Response(null, { status: 503 }) }),
    now,
    [],
    valueTargets,
  );
  expect(result.probes.find((row) => row.id === "shard:0xa")!.status).toBe("down");
});

it("treats directory entry-unavailable facts as an outage even if world heads are fresh", async () => {
  const result = await probeServices(
    network({
      "https://play.realms.party/api/directory": response({
        shards: [{ ...world, games: [{ error: "unavailable" }] }],
      }),
    }),
    now,
    [],
    valueTargets,
  );
  expect(result.probes.find((row) => row.id === "directory")!.status).toBe("down");
  expect(result.probes.find((row) => row.id === "shard:0xa")!.status).toBe("up");
});

it("observes the ledger pause flag independently and exposes unknown instead of a false flag", async () => {
  const base = network();
  const paused: typeof fetch = async (input, init) => {
    if (String(input) === valueTargets.ledgerRpcUrl && JSON.parse(String(init?.body)).method === "starknet_call")
      return response({ jsonrpc: "2.0", id: 2, result: ["0x1"] });
    return base(input, init);
  };
  const snapshot = await probeServices(paused, now, [], valueTargets);
  expect(snapshot.probes.find((row) => row.id === "ledger")).toMatchObject({ status: "degraded", paused: true });
  const unavailable = await probeServices(
    network({ [valueTargets.ledgerRpcUrl]: new Response(null, { status: 503 }) }),
    now,
    [],
    valueTargets,
  );
  expect(unavailable.probes.find((row) => row.id === "ledger")).toMatchObject({ status: "down", paused: null });
});
it("does not share the identity route with its direct guardian probe and rejects a stale relay heartbeat", async () => {
  const snapshot = await probeServices(
    network({
      "https://play.realms.party/api/health/accounts": new Response(null, { status: 503 }),
      [valueTargets.playUrl + "/api/value/health"]: response({
        service: "value-relay",
        success: true,
        checked_at: now - 301,
      }),
    }),
    now,
    [],
    valueTargets,
  );
  expect(snapshot.probes.find((row) => row.id === "accounts")!.status).toBe("down");
  expect(snapshot.probes.find((row) => row.id === "guardian")!.status).toBe("up");
  expect(snapshot.probes.find((row) => row.id === "relay")!.status).toBe("down");
});
it("pins the independent ledger flag read to the confirmed header it checked", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(network());
  await probeServices(fetch, now, [], valueTargets);
  const call = fetch.mock.calls.find(
    ([url, init]) =>
      String(url) === valueTargets.ledgerRpcUrl && JSON.parse(String(init?.body)).method === "starknet_call",
  )!;
  expect(JSON.parse(String(call[1]!.body)).params).toMatchObject({
    request: { contract_address: "0x123", calldata: [] },
    block_id: { block_number: 10 },
  });
});

it("probes a single-RPC shard manifest without a removed admission endpoint", async () => {
  const read = vi.fn(
    network({ "https://shard.public.test/manifest": response({ chainId: "0xa", rpcUrl: "https://rpc.public.test" }) }),
  );
  const result = await probeServices(read, now, [], valueTargets);
  expect(result.probes.find((p) => p.id === "shard:0xa")!.status).toBe("up");
  expect(read.mock.calls.some((call) => String(call[0]).includes("admission"))).toBe(false);
});

it("publishes an undeployed ledger as down and probes the configured play site", async () => {
  const environment = vi
    .spyOn(chain, "environmentL2")
    .mockReturnValue({ network: "mainnet", chain: "SN_MAIN", ledger: null });
  const put = vi.fn().mockResolvedValue({ etag: "one" });
  const read = vi.fn(network());
  vi.stubGlobal("fetch", read);
  try {
    await worker.scheduled({} as ScheduledController, {
      STATUS_BUCKET: { get: async () => null, put } as unknown as R2Bucket,
      ENVIRONMENT: "staging",
      BASE_URL: "https://preview.public.test",
      L2_RPC_URL: valueTargets.ledgerRpcUrl,
    });
    const published = JSON.parse(put.mock.calls[0]![1]);
    expect(published.document.components.find((row: { id: string }) => row.id === "ledger")).toMatchObject({
      status: "down",
      paused: null,
    });
    expect(read.mock.calls.some(([url]) => String(url) === "https://preview.public.test/api/slots")).toBe(true);
    expect(read.mock.calls.some(([url]) => String(url).startsWith("https://play.realms.party"))).toBe(false);
  } finally {
    vi.unstubAllGlobals();
    environment.mockRestore();
  }
});

it("derives all three health addresses from the play origin", async () => {
  const read = vi.fn(network());
  await probeServices(read, now, [], { ...valueTargets, playUrl: "https://play.dev-realms.party" });
  const urls = read.mock.calls.map(([url]) => String(url));
  for (const path of ["/api/guardian", "/api/value/health", "/api/operator/monitor/health"])
    expect(urls).toContain("https://play.dev-realms.party" + path);
  expect(urls.some((url) => url.startsWith(valueTargets.playUrl))).toBe(false);
});
it.each([
  ["guardian", "/api/guardian", { publicKey: "0x1" }],
  ["monitor", "/api/operator/monitor/health", { service: "value-monitor", success: true, checked_at: now - 301 }],
  ["monitor", "/api/operator/monitor/health", { service: "value-relay", success: true, checked_at: now }],
] as const)("reports malformed or stale %s health as down", async (id, path, body) => {
  const result = await probeServices(network({ [valueTargets.playUrl + path]: response(body) }), now, [], valueTargets);
  expect(result.probes.find((probe) => probe.id === id)!.status).toBe("down");
});

it("reports game launches down while a run has failed or is stranded", async () => {
  const stranded = await probeServices(
    network({
      "https://play.realms.party/api/factory/health": Response.json(
        { service: "launch", failedRuns: [], joinFailures: [], freezeFailures: [], strandedRuns: [{ id: 7 }] },
        { status: 503 },
      ),
    }),
    now,
    [],
    valueTargets,
  );
  expect(stranded.probes.find((p) => p.id === "launch")).toMatchObject({ status: "down", latency_ms: null });
});

/**
 * Resend's idempotency contract: a key is kept 24 hours; the same key with the same payload answers its first answer and
 * sends nothing; the same key with another payload is refused with 409; a key past its 24 hours is new. `loseAnswers`
 * delivers and then drops the answer, as a connection reset after the provider took the request.
 */
const resend = (clock: () => number) => {
  const keys = new Map<string, { body: string; at: number }>();
  const emails: { key: string; subject: string; text: string }[] = [];
  const conflicts: string[] = [];
  const provider = { emails, conflicts, refuse: false, loseAnswers: 0 };
  const send: typeof fetch = async (input, init) => {
    expect(String(input)).toBe("https://api.resend.com/emails");
    if (provider.refuse) return new Response(null, { status: 500 });
    const key = new Headers(init?.headers).get("idempotency-key")!;
    const body = String(init?.body);
    const known = keys.get(key);
    if (known && clock() - known.at < 86_400) {
      if (known.body !== body) {
        conflicts.push(key);
        return new Response(null, { status: 409 });
      }
    } else {
      keys.set(key, { body, at: clock() });
      const email = JSON.parse(body);
      emails.push({ key, subject: email.subject, text: email.text });
    }
    if (provider.loseAnswers > 0) {
      provider.loseAnswers--;
      throw new TypeError("connection reset");
    }
    return Response.json({ id: key });
  };
  return { provider, send };
};
const alerting = { apiKey: "re_test", to: "oncall@example.test", environment: "staging" };
const probe = (id: string, name: string, status: "up" | "degraded" | "down") => ({
  id,
  name,
  status,
  latency_ms: status === "down" ? null : 10,
});
/** Observes the probes minute by minute from `start`, through `minutes` more, recording notices as the monitor does. */
const observe = (
  from: { state: MonitorState | null; alerts: typeof NO_ALERTS },
  start: number,
  minutes: number,
  probes: ReturnType<typeof probe>[],
) => {
  let { state, alerts } = from;
  for (let minute = 0; minute <= minutes; minute++) {
    state = nextMonitorState(state, start + minute * 60, probes, [])!;
    alerts = recordNotices(state.document, alerts, alerting);
  }
  return { state, alerts };
};
const MINUTES = SUSTAINED_SECONDS / 60;

it("emails an outage of something players use once it lasts ten minutes, once, and again when it resolves", () => {
  expect(SUSTAINED_SECONDS).toBe(600);
  const down = [probe("accounts", "Sign in and accounts", "down")];
  let run = observe({ state: null, alerts: NO_ALERTS }, now, MINUTES - 1, down);
  expect(run.alerts.outbox).toEqual([]);
  run = observe(run, now + MINUTES * 60, 2, down);
  expect(run.alerts.told).toEqual([`accounts:${now}`]);
  expect(run.alerts.outbox).toEqual([
    expect.objectContaining({
      key: `staging:accounts:${now}:opened`,
      recorded_at: now + SUSTAINED_SECONDS,
      to: "oncall@example.test",
      subject: "[staging] Sign in and accounts: unavailable",
    }),
  ]);
  run = observe(run, now + (MINUTES + 3) * 60, 0, [probe("accounts", "Sign in and accounts", "up")]);
  expect(run.alerts.told).toEqual([]);
  expect(run.alerts.outbox.map(({ key }) => key)).toEqual([
    `staging:accounts:${now}:opened`,
    `staging:accounts:${now}:resolved`,
  ]);
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(recordNotices(run.state!.document, NO_ALERTS, undefined)).toEqual({ told: [], outbox: [], sent: [] });
  } finally {
    errors.mockRestore();
  }
});

it("emails nothing for a short outage, a slowdown, or a component players do not use", () => {
  const quiet = (probes: ReturnType<typeof probe>[], minutes: number) => {
    const run = observe({ state: null, alerts: NO_ALERTS }, now, minutes, probes);
    return observe(run, now + (minutes + 1) * 60, 0, [probe(probes[0]!.id, probes[0]!.name, "up")]).alerts;
  };
  // A blip: down for nine minutes, then up; neither its start nor its recovery is told.
  expect(quiet([probe("shard:0xa", "herald.public.test", "down")], MINUTES - 1)).toEqual(NO_ALERTS);
  // A world an hour behind by a few blocks, or slow: degraded only, however long.
  expect(quiet([probe("shard:0xa", "herald.public.test", "degraded")], 60)).toEqual(NO_ALERTS);
  // Down for an hour, but not something players use: the status page shows it.
  for (const [id, name] of [
    ["chat", "Chat"],
    ["directory", "Games list"],
    ["relay", "Value relay"],
    ["ledger", "Starknet ledger"],
    ["node:0xa", "herald.public.test node memory"],
  ] as const)
    expect(quiet([probe(id, name, "down")], 60)).toEqual(NO_ALERTS);
});

it("counts an outage from when it went down, and names it unavailable even if it began slow", () => {
  const launch = (status: "degraded" | "down") => [probe("launch", "Game launches and seating", status)];
  let run = observe({ state: null, alerts: NO_ALERTS }, now, 30, launch("degraded"));
  run = observe(run, now + 31 * 60, MINUTES - 1, launch("down"));
  expect(run.alerts.outbox).toEqual([]);
  run = observe(run, now + (31 + MINUTES) * 60, 0, launch("down"));
  expect(run.alerts.outbox).toEqual([
    expect.objectContaining({
      key: `staging:launch:${now}:opened`,
      subject: "[staging] Game launches and seating: unavailable",
    }),
  ]);
  expect(run.state!.document.incidents[0]!.title).toBe("Game launches and seating: unavailable");
});

it("tells components that go down together in one email, and their recovery in one", () => {
  const box = (status: "up" | "down") => [
    probe("launch", "Game launches and seating", status),
    probe("shard:0xa", "herald.public.test", status),
  ];
  let run = observe({ state: null, alerts: NO_ALERTS }, now, MINUTES, box("down"));
  expect(run.alerts.outbox).toEqual([
    expect.objectContaining({
      key: `staging:shard:0xa:${now}+launch:${now}:opened`,
      subject: "[staging] herald.public.test: unavailable; Game launches and seating: unavailable",
    }),
  ]);
  run = observe(run, now + (MINUTES + 1) * 60, 0, box("up"));
  expect(run.alerts.outbox.map(({ key }) => key)).toEqual([
    `staging:shard:0xa:${now}+launch:${now}:opened`,
    `staging:shard:0xa:${now}+launch:${now}:resolved`,
  ]);
});

it("sends at most four emails in any 24 hours however a component flaps, the fourth saying so", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const accounts = (status: "up" | "down") => [probe("accounts", "Sign in and accounts", status)];
    let run: { state: MonitorState | null; alerts: typeof NO_ALERTS } = { state: null, alerts: NO_ALERTS };
    const notices = new Map<string, (typeof run.alerts.outbox)[number]>();
    const collect = () => run.alerts.outbox.forEach((notice) => notices.set(notice.key, notice));
    let at = now;
    // Down for ten minutes, up for one, all day: 120 outages and recoveries.
    while (at < now + 24 * 3600) {
      run = observe(run, at, MINUTES, accounts("down"));
      collect();
      run = observe(run, at + (MINUTES + 1) * 60, 0, accounts("up"));
      collect();
      at += (MINUTES + 2) * 60;
    }
    expect(notices.size).toBe(DAILY_EMAILS);
    const [first, ...rest] = [...notices.values()];
    expect(first!.text).not.toContain("Alert limit reached");
    expect(rest.at(-1)!.text).toContain(
      `Alert limit reached: no more email until ${new Date((first!.recorded_at + 24 * 3600) * 1000).toISOString()}.`,
    );
    expect(errors.mock.calls.some(([line]) => String(line).includes(`"status_alert_capped"`))).toBe(true);
    // Once the first email is a day old, the next outage is told again.
    run = observe(run, at, MINUTES, accounts("down"));
    collect();
    expect(notices.size).toBe(DAILY_EMAILS + 1);
  } finally {
    errors.mockRestore();
  }
});

/** The monitor's real R2 bucket on Miniflare, whose next writes can be made to fail. */
const monitored = async () => {
  const mf = new Miniflare({
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
    r2Buckets: ["STATUS_BUCKET"],
    compatibilityDate: "2026-07-30",
  });
  const bucket = (await mf.getR2Bucket("STATUS_BUCKET")) as unknown as R2Bucket;
  let failing = new Set<number>();
  let writes = 0;
  const flaky = new Proxy(bucket, {
    get(target, property) {
      if (property === "put")
        return async (...args: Parameters<R2Bucket["put"]>) => (failing.has(++writes) ? null : target.put(...args));
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  let clock = now;
  const { provider, send } = resend(() => clock);
  const accountsHealth = { ok: false };
  const accounts = (input: RequestInfo | URL, init?: RequestInit) =>
    String(input) === "https://api.resend.com/emails"
      ? send(input, init)
      : network({ "https://play.realms.party/api/health/accounts": response({ success: accountsHealth.ok }) })(
          input,
          init,
        );
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  return {
    provider,
    accountsHealth,
    errors,
    /** One minute's run; `failWrites` names which of its writes fail (1 = its observation, 2 = its confirmation). */
    run: (at: number, failWrites: number[] = []) => {
      clock = at;
      failing = new Set(failWrites.map((write) => writes + write));
      return monitor(flaky, accounts, at, valueTargets, alerting);
    },
    state: async () => (await bucket.get("state.json"))!.json<MonitorState>(),
    accountsEmails: () => provider.emails.filter(({ key }) => key.includes(":accounts:")).map(({ key }) => key),
    close: async () => {
      errors.mockRestore();
      await disposeWorker(mf);
    },
  };
};

it("sends one recovery when the write confirming it fails, even after Resend forgets the key", async () => {
  const m = await monitored();
  try {
    for (let minute = 0; minute <= MINUTES + 1; minute++) await m.run(now + minute * 60);
    m.accountsHealth.ok = true;
    await m.run(now + SUSTAINED_SECONDS + 120, [2]); // the recovery is sent; the write confirming it fails
    expect((await m.state()).alerts!.outbox.map(({ key }) => key)).toContain(`staging:accounts:${now}:resolved`);
    await m.run(now + SUSTAINED_SECONDS + 180); // retried as recorded: Resend answers its first answer and sends nothing
    expect((await m.state()).alerts!.outbox.filter(({ key }) => key.includes(":accounts:"))).toEqual([]);
    await m.run(now + SUSTAINED_SECONDS + 180 + 25 * 3600); // past the key's life, nothing is left to send
    expect(m.accountsEmails()).toEqual([`staging:accounts:${now}:opened`, `staging:accounts:${now}:resolved`]);
  } finally {
    await m.close();
  }
});

it("sends nothing from an observation whose write fails, and records the change again on the next one", async () => {
  const m = await monitored();
  try {
    for (let minute = 0; minute <= MINUTES + 1; minute++) await m.run(now + minute * 60);
    m.accountsHealth.ok = true;
    await expect(m.run(now + SUSTAINED_SECONDS + 120, [1])).rejects.toThrow("superseded");
    expect(m.accountsEmails()).toEqual([`staging:accounts:${now}:opened`]);
    await m.run(now + SUSTAINED_SECONDS + 180);
    expect(m.accountsEmails()).toEqual([`staging:accounts:${now}:opened`, `staging:accounts:${now}:resolved`]);
  } finally {
    await m.close();
  }
});

it("sends once when Resend delivers but its answer is lost", async () => {
  const m = await monitored();
  try {
    for (let minute = 0; minute < MINUTES; minute++) await m.run(now + minute * 60);
    m.provider.loseAnswers = 1;
    await m.run(now + SUSTAINED_SECONDS);
    expect((await m.state()).alerts!.outbox.map(({ key }) => key)).toContain(`staging:accounts:${now}:opened`);
    await m.run(now + SUSTAINED_SECONDS + 60);
    expect((await m.state()).alerts!.outbox.filter(({ key }) => key.includes(":accounts:"))).toEqual([]);
    expect(m.accountsEmails()).toEqual([`staging:accounts:${now}:opened`]);
  } finally {
    await m.close();
  }
});

it("drops a notice Resend never confirmed once the key would have expired, and never sends it", async () => {
  const m = await monitored();
  try {
    m.provider.refuse = true;
    for (let minute = 0; minute <= MINUTES; minute++) await m.run(now + minute * 60);
    expect((await m.state()).alerts!.outbox.map(({ key }) => key)).toContain(`staging:accounts:${now}:opened`);
    await m.run(now + SUSTAINED_SECONDS + NOTICE_LIFETIME_SECONDS - 60); // still within: retried, still refused
    m.provider.refuse = false;
    await m.run(now + SUSTAINED_SECONDS + NOTICE_LIFETIME_SECONDS); // expired: dropped, not sent
    expect(m.accountsEmails()).toEqual([]);
    expect((await m.state()).alerts!.outbox.filter(({ key }) => key.includes(":accounts:"))).toEqual([]);
    expect(m.errors.mock.calls.some(([line]) => String(line).includes(`"status_alert_expired"`))).toBe(true);
  } finally {
    await m.close();
  }
});

it("sends nothing from an overlapping observation that loses its write", async () => {
  const mf = new Miniflare({
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
    r2Buckets: ["STATUS_BUCKET"],
    compatibilityDate: "2026-07-30",
  });
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const bucket = (await mf.getR2Bucket("STATUS_BUCKET")) as unknown as R2Bucket;
    let clock = now;
    const { provider, send } = resend(() => clock);
    const down = network({ "https://play.realms.party/api/health/accounts": response({ success: false }) });
    const mail =
      (fallback: typeof fetch): typeof fetch =>
      (input, init) =>
        String(input) === "https://api.resend.com/emails" ? send(input, init) : fallback(input, init);
    for (let minute = 0; minute <= MINUTES; minute++) {
      clock = now + minute * 60;
      await monitor(bucket, mail(down), clock, valueTargets, alerting);
    }
    // Chat recovers. The late run reads the state and waits in its probes, while a newer run records and sends the
    // recovery with its own time; the late run's recovery would say another time under the same key.
    let unblock!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => (unblock = resolve));
    const started = new Promise<void>((resolve) => (entered = resolve));
    const slow: typeof fetch = async (input, init) => {
      if (String(input).endsWith("/api/directory")) {
        entered();
        await gate;
      }
      return network()(input, init);
    };
    clock = now + SUSTAINED_SECONDS + 60;
    const late = monitor(bucket, mail(slow), now + SUSTAINED_SECONDS + 60, valueTargets, alerting);
    await started;
    clock = now + SUSTAINED_SECONDS + 120;
    await monitor(bucket, mail(network()), now + SUSTAINED_SECONDS + 120, valueTargets, alerting);
    unblock();
    await expect(late).rejects.toThrow("superseded");
    const recoveries = provider.emails.filter(({ key }) => key === `staging:accounts:${now}:resolved`);
    expect(recoveries).toHaveLength(1);
    expect(recoveries[0]!.text).toContain(new Date((now + SUSTAINED_SECONDS + 120) * 1000).toISOString());
    // The superseded run never tried: no send under the key with another payload.
    expect(provider.conflicts).toEqual([]);
  } finally {
    errors.mockRestore();
    await disposeWorker(mf);
  }
});

it("alerts on a node's memory share, a stopped node, and a sample it cannot trust", async () => {
  const health = (node: unknown) =>
    response({ service: "herald", success: true, confirmed_block: 10, undecodable_events: 0, node });
  for (const [node, status] of [
    [{ sampled_at: now, memory_bytes: 47e9, host_memory_bytes: 96e9 }, "up"],
    [{ sampled_at: now, memory_bytes: 48e9, host_memory_bytes: 96e9 }, "degraded"],
    [{ sampled_at: now, memory_bytes: 72e9, host_memory_bytes: 96e9 }, "down"],
    [{ sampled_at: now, memory_bytes: null, host_memory_bytes: 96e9 }, "down"],
    [{ sampled_at: now - 61, memory_bytes: 2e9, host_memory_bytes: 96e9 }, "degraded"],
    [null, "degraded"],
  ] as const) {
    const result = await probeServices(
      network({ "https://shard.public.test/health": health(node) }),
      now,
      [],
      valueTargets,
    );
    expect(result.probes.find((p) => p.id === "node:0xa")!.status).toBe(status);
  }
});

it("shows no node row for a Herald that publishes no node memory, while its world is still probed", async () => {
  const result = await probeServices(
    network({
      "https://shard.public.test/health": response({
        service: "herald",
        success: true,
        confirmed_block: 10,
        undecodable_events: 0,
      }),
    }),
    now,
    [],
    valueTargets,
  );
  expect(result.probes.find((p) => p.id === "shard:0xa")!.status).toBe("up");
  expect(result.probes.some((p) => p.id === "node:0xa")).toBe(false);
});
