// The lab's stand-in for the admin Worker: the page's own files, answered from fixtures in its API's shapes, so the
// owner reviews the real page without a deploy, Access or a token. Every value below is invented.
const now = Date.parse("2026-10-16T14:30:00Z");
const probe = (id, name, status, latency_ms) => ({ id, name, status, latency_ms });
const run = (gameName, environment, status, gameId, kind = "game") => ({
  gameName,
  environment,
  kind,
  status,
  createdAt: new Date(now - gameName.length * 60_000).toISOString(),
  artifacts: { gameId },
  recovery: {
    canContinue: status === "attention",
    canDelete: kind === "game" && environment !== "madara.frontier" && status === "attention",
  },
});

const ENVIRONMENTS = {
  dev: {
    origin: "https://play.dev-realms.party",
    components: [
      probe("play", "Play", "up", 182),
      probe("herald-0x6230", "Herald · chain …6230", "up", 96),
      probe("node-0x6230", "Node head", "up", 140),
      probe("launch", "Launch service", "up", 120),
      probe("value", "Value relay", "degraded", 1420),
    ],
    phases: [{ phase: "frontier", presetId: 5, startsAt: "2026-10-15T20:00:00Z", endsAt: "2026-10-22T20:00:00Z" }],
    slots: [
      {
        chainId: "0x6230",
        slotId: 4,
        name: "blitz-20261016-1600",
        closesAt: "2026-10-16T15:55:00Z",
        frozenAt: null,
        closed: false,
      },
      {
        chainId: "0x6230",
        slotId: 3,
        name: "blitz-20261016-1400",
        closesAt: "2026-10-16T13:55:00Z",
        frozenAt: "2026-10-16T13:55:00Z",
        closed: true,
      },
    ],
    runs: [
      run("test-owner-crates", "madara.blitz", "complete", 7),
      run("frontier-1760558400", "madara.frontier", "running", 1),
      run("blitz-20261016-1400", "madara.blitz", "attention", undefined),
    ],
    workers: { version: "5c1d…", revision: "7ba76ed03a0" },
    client: "7ba76ed03a0",
    shards: [{ url: "https://herald.dev-realms.party", chainId: "0x4445565f…6230", status: "active" }],
  },
  production: {
    origin: "https://play.realms.party",
    components: [
      probe("play", "Play", "up", 88),
      probe("herald-mainnet", "Herald · mainnet shard", "up", 74),
      probe("launch", "Launch service", "up", 91),
      probe("value", "Value relay", "up", 230),
    ],
    phases: [{ phase: "frontier", presetId: 6, startsAt: "2026-11-03T06:30:00Z", endsAt: "2026-11-06T14:30:00Z" }],
    slots: [],
    runs: [run("frontier-1761933600", "madara.frontier", "queued", undefined)],
    workers: { version: "a90e…", revision: "b015a52b6c9" },
    client: "b015a52b6c9",
    shards: [{ url: "https://herald.realms.party", chainId: "0x…mainnet", status: "active" }],
  },
};

const audit = [
  {
    id: 2,
    at: now - 40 * 60_000,
    email: "owner@realms.world",
    environment: "dev",
    action: "Free test Blitz",
    request: "{}",
    state: "done",
    status: 202,
    response: "{}",
  },
  {
    id: 1,
    at: now - 90 * 60_000,
    email: "owner@realms.world",
    environment: "dev",
    action: "Set frontier phase",
    request: "{}",
    state: "done",
    status: 200,
    response: "{}",
  },
];

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const ok = (value) => ({ ok: true, value });

const games = (environment) => {
  const env = ENVIRONMENTS[environment];
  return {
    environment,
    origin: env.origin,
    status: ok({ checkedAt: Math.floor(now / 1000), components: env.components }),
    calendar: ok(env.phases),
    slots: ok(env.slots),
    runs: ok(env.runs),
  };
};

const deploys = (environment) => {
  const env = ENVIRONMENTS[environment];
  return {
    environment,
    workers: ok(env.workers),
    client: ok(env.client),
    shards: ok(env.shards),
    commands: {
      box: `pnpm run deploy ${environment}`,
      cloudflare: `pnpm run deploy:cloudflare ${environment} "$HOME/.realms-${environment}"`,
    },
  };
};

/** A write as the Worker answers it, with the audit row it leaves. */
const write = (environment, route, body) => {
  const env = ENVIRONMENTS[environment];
  const [first, ...rest] = route;
  let action = route.join(" ");
  if (first === "test-blitz") {
    if (environment !== "dev") return json({ error: "Not Found" }, 404);
    if (!/^test-[a-z0-9-]{1,26}$/.test(body.name ?? "")) return json({ error: "Invalid test Blitz" }, 400);
    env.runs.unshift(run(body.name, "madara.blitz", "queued", undefined));
    action = "Free test Blitz";
  }
  if (first === "slots" && rest.length === 0) {
    env.slots.unshift({
      chainId: "",
      slotId: env.slots.length + 1,
      name: body.name,
      closesAt: body.closesAt,
      frozenAt: null,
      closed: false,
    });
    action = "Open Blitz slot";
  }
  if (first === "calendar") {
    env.phases = [...env.phases.filter((entry) => entry.phase !== rest[0]), { phase: rest[0], ...body }];
    action = `Set ${rest[0]} phase`;
  }
  if (first === "runs" || first === "results") {
    const [, name, verb] = rest;
    const target = env.runs.find((entry) => entry.gameName === name);
    if (verb === "delete") env.runs = env.runs.filter((entry) => entry !== target);
    else if (target) Object.assign(target, { status: "queued", recovery: { canContinue: false } });
    action = `${verb} ${first} ${name}`;
  }
  audit.unshift({
    id: audit.length + 1,
    at: Date.now(),
    email: "owner@realms.world",
    environment,
    action,
    request: JSON.stringify(body ?? null),
    state: "done",
    status: 202,
    response: "{}",
  });
  return json({ status: "queued" }, 202);
};

// Each environment has its own admin; the lab plays either, named by `?environment=`, and links to the other.
const environment = new URLSearchParams(location.search).get("environment") === "production" ? "production" : "dev";
const other = environment === "dev" ? "production" : "dev";

window.fetch = async (input, init = {}) => {
  const path = new URL(input, location.href).pathname;
  const method = init.method ?? "GET";
  if (path === "/api/session")
    return json({
      email: "owner@realms.world",
      environment,
      other: { environment: other, url: `?environment=${other}` },
    });
  if (path === "/api/audit") return json({ actions: audit.filter((row) => row.environment === environment) });
  if (path === "/api/games") return json(games(environment));
  if (path === "/api/deploys") return json(deploys(environment));
  if (method !== "GET" && path.startsWith("/api/actions/"))
    return write(
      environment,
      path.slice("/api/actions/".length).split("/"),
      init.body ? JSON.parse(init.body) : undefined,
    );
  return json({ error: "Not Found" }, 404);
};
