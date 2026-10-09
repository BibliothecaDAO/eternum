import { expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";
import { monitor } from "./worker";
import { probeServices } from "./probes";
import { nextMonitorState } from "./state";
import { onRequestGet } from "../../status/functions/status.json";

const now = 1791456000;
const world = { url: "https://shard.public.test", chainId: "0xa", status: "active" };
const response = (value: unknown) => Response.json(value);
const network =
  (overrides: Record<string, Response> = {}) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/\/$/, "");
    if (overrides[url]) return overrides[url]!.clone();
    if (url.endsWith("/api/directory")) return response({ shards: [{ ...world, games: [] }] });
    if (url.endsWith("/api/slots")) return response({ slots: [] });
    if (url.endsWith("/api/guardian")) return response({ publicKey: "0x1", accountClassHash: "0x2" });
    if (url.endsWith("/api/health/accounts") || url.endsWith("/api/chat/health")) return response({ success: true });
    if (url.endsWith("/manifest"))
      return response({
        chainId: "0xa",
        rpcUrl: "https://rpc.public.test",
        admissionUrl: "https://admission.public.test",
      });
    if (url.endsWith("/health"))
      return response({ service: "herald", success: true, confirmed_block: 10, undecodable_events: 0 });
    if (url === "https://admission.public.test")
      return response({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } });
    if (url === "https://rpc.public.test") {
      const rpc = JSON.parse(String(init?.body));
      return response({ jsonrpc: "2.0", id: rpc.id, result: { block_number: 10, timestamp: now } });
    }
    if (url.endsWith("/main.js")) return new Response("export {};", { headers: { "content-type": "text/javascript" } });
    return new Response('<script type="module" src="/main.js"></script>');
  };

it("probes every public path and world, not merely a directory200", async () => {
  const result = await probeServices(network(), now, []);
  expect(result.probes.map((p) => [p.id, p.status])).toEqual([
    ["play", "up"],
    ["accounts", "up"],
    ["directory", "up"],
    ["blitz", "up"],
    ["chat", "up"],
    ["shard:0xa", "up"],
  ]);
  const failed = await probeServices(
    network({ "https://shard.public.test/health": new Response(null, { status: 503 }) }),
    now,
    [],
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
    );
    expect(result.probes.find((p) => p.id === "shard:0xa")!.status).toBe(status);
  }
  const html = await probeServices(
    network({
      "https://play.realms.party/main.js": new Response("<html/>", { headers: { "content-type": "text/html" } }),
    }),
    now,
    [],
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
    await monitor(bucket, network(), now);
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
    const late = monitor(bucket, slow, now + 60);
    await entered;
    await monitor(bucket, network(), now + 120);
    unblock();
    await expect(late).rejects.toThrow("superseded");
    const published = await (await bucket.get("state.json"))!.json<{ document: { checked_at: number } }>();
    expect(published.document.checked_at).toBe(now + 120);
    const etag = (await bucket.get("state.json"))!.etag;
    await monitor(bucket, network(), now + 120);
    expect((await bucket.get("state.json"))!.etag).toBe(etag);
  } finally {
    await mf.dispose();
  }
});

it("marks a slow successful read degraded and a timed-out read down", async () => {
  const clock = vi.spyOn(performance, "now");
  let tick = 0;
  clock.mockImplementation(() => {
    tick += 1100;
    return tick;
  });
  const slow = await probeServices(network(), now, []);
  expect(slow.probes[0]!.status).toBe("degraded");
  clock.mockRestore();
  const timeout: typeof fetch = async (input, init) => {
    if (String(input).endsWith("/api/chat/health")) throw new Error("timed out");
    return network()(input, init);
  };
  expect((await probeServices(timeout, now, [])).probes.find((p) => p.id === "chat")!.status).toBe("down");
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

it("does not mark a world healthy when its admission listener is unreachable", async () => {
  const result = await probeServices(
    network({ "https://admission.public.test": new Response(null, { status: 503 }) }),
    now,
    [],
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
  );
  expect(result.probes.find((row) => row.id === "directory")!.status).toBe("down");
  expect(result.probes.find((row) => row.id === "shard:0xa")!.status).toBe("up");
});
