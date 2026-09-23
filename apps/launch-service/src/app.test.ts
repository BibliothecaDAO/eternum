import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createLaunchApp } from "./app";
import { scheduleFrontierSeason } from "./schedule";
import type { IdentityResolver } from "./auth";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase } from "./test-database";

const ALLOWED_ORIGIN = "https://play.realms.party";
const ALLOWED_ADDRESS = "0x123";

const PLAYER = "0x7";
const PLAYER_ACCOUNT = "0xacc";

/** A signed-in Realms account, with the wallet linked to it, if any. */
const signedIn = (wallet: string | null = null): IdentityResolver => ({
  resolve: () => Effect.succeed({ realmsId: PLAYER, wallet }),
});
const signedOut: IdentityResolver = { resolve: () => Effect.succeed(null) };

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  await database.close();
});

const createApp = (
  resolver: IdentityResolver,
  slots = new D1SlotStore(database.db),
  playerAccount = vi.fn(async (_realmsId: string) => PLAYER_ACCOUNT),
) => {
  const store = new D1LaunchStore(database.db);
  return {
    app: createLaunchApp({
      config: {
        allowedOrigins: new Set([ALLOWED_ORIGIN]),
        launcherAllowlist: new Set([ALLOWED_ADDRESS]),
      },
      deployment: { environment: "staging", version: "test" },
      identity: resolver,
      store,
      slots,
      playerAccount,
    }),
    store,
    slots,
    playerAccount,
  };
};

describe("free slot registration", () => {
  const registerRequest = () =>
    new Request("https://play.realms.party/api/slots/friday/register", {
      method: "POST",
      headers: {
        origin: ALLOWED_ORIGIN,
        cookie: "better-auth.session_token=valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ owner: "0xdead", account: "0xbeef" }),
    });

  test("registers the signed-in Realms account and its shard account, with no wallet or launcher privileges", async () => {
    const { app, slots, playerAccount } = createApp(signedIn());
    await slots.create("friday", "2099-01-01T00:00:00.000Z");
    const response = await app.request(registerRequest());
    expect(response.status).toBe(200);
    expect((await slots.list())[0]!.registrations).toMatchObject([{ realmsId: PLAYER, account: PLAYER_ACCOUNT }]);
    expect(playerAccount).toHaveBeenCalledWith(PLAYER);
  });

  test("does not register a player whose shard account cannot be read", async () => {
    const slots = new D1SlotStore(database.db);
    const { app } = createApp(
      signedIn("0x456"),
      slots,
      vi.fn(async () => {
        throw new Error("Shard https://shard.test manifest failed: 503");
      }),
    );
    expect((await app.request(registerRequest())).status).toBe(503);
    expect(await slots.list()).toEqual([]);
  });

  test("does not register unauthenticated or cross-origin requests", async () => {
    const { app, slots } = createApp(signedOut);
    expect((await app.request(registerRequest())).status).toBe(401);
    const request = registerRequest();
    request.headers.set("origin", "https://untrusted.example");
    expect((await app.request(request)).status).toBe(403);
    expect(await slots.list()).toEqual([]);
  });
});

const launchRequest = () =>
  new Request("https://play.realms.party/api/factory/runs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "better-auth.session_token=valid",
      origin: ALLOWED_ORIGIN,
    },
    body: JSON.stringify({ environment: "madara.blitz", gameName: "bltz-effect-test" }),
  });

describe("launch service authorization", () => {
  test("rejects a mutation without a verified session", async () => {
    const { app } = createApp(signedOut);
    const response = await app.request(launchRequest());
    expect(response.status).toBe(401);
  });

  test("rejects an allowlisted session from a spoofed or omitted origin", async () => {
    const { app } = createApp(signedIn(ALLOWED_ADDRESS));
    const spoofed = launchRequest();
    spoofed.headers.set("origin", "https://attacker.example");
    expect((await app.request(spoofed)).status).toBe(403);

    const omitted = launchRequest();
    omitted.headers.delete("origin");
    expect((await app.request(omitted)).status).toBe(403);
  });

  test("rejects a signed-in address outside the launcher allowlist", async () => {
    const { app } = createApp(signedIn("0x456"));
    expect((await app.request(launchRequest())).status).toBe(403);
    const noWallet = createApp(signedIn()).app;
    expect((await noWallet.request(launchRequest())).status).toBe(403);
  });

  test("returns the requested format when launching and listing Eternum games", async () => {
    const { app } = createApp(signedIn(ALLOWED_ADDRESS));
    const request = launchRequest();
    const response = await app.request(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({ environment: "madara.eternum", gameName: "eternum-factory-test", version: "3" }),
      }),
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ gameType: "eternum", environment: "madara.eternum" });
    const listed = await app.request("https://play.realms.party/api/factory/runs?environment=madara.eternum");
    expect(await listed.json()).toMatchObject({ runs: [{ gameType: "eternum", gameName: "eternum-factory-test" }] });
  });

  test("queues an authorized launch and keeps reads public", async () => {
    const { app } = createApp(signedIn(ALLOWED_ADDRESS));
    const created = await app.request(launchRequest());
    expect(created.status).toBe(202);
    expect(await created.json()).toMatchObject({
      environment: "madara.blitz",
      gameName: "bltz-effect-test",
      status: "running",
      workflow: { workflowName: "box-native" },
    });

    const listed = await app.request("https://play.realms.party/api/factory/runs?environment=madara.blitz");
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({ runs: [{ gameName: "bltz-effect-test" }] });
  });

  test("rejects Duel and unregistered presets at the schema", async () => {
    const { app } = createApp(signedIn(ALLOWED_ADDRESS));
    const duel = new Request(launchRequest(), {
      body: JSON.stringify({ environment: "madara.blitz", gameName: "bltz-duel-game", version: "4" }),
    });
    expect((await app.request(duel)).status).toBe(400);
    const request = launchRequest();
    request.headers.set("content-type", "application/json");
    const invalid = new Request(request, {
      body: JSON.stringify({
        environment: "madara.blitz",
        gameName: "bltz-invalid-profile",
        version: "5",
      }),
    });

    expect((await app.request(invalid)).status).toBe(400);
  });

  test("launches a real game dev-off and stores devModeOn:false", async () => {
    const { app, store } = createApp(signedIn(ALLOWED_ADDRESS));
    const request = launchRequest();
    request.headers.set("content-type", "application/json");
    const realGame = new Request(request, {
      body: JSON.stringify({
        environment: "madara.blitz",
        gameName: "bltz-real-game",
        devModeOn: false,
      }),
    });

    expect((await app.request(realGame)).status).toBe(202);
    const run = await store.find("game", "madara.blitz", "bltz-real-game");
    expect(run && "devModeOn" in run.request ? run.request.devModeOn : undefined).toBe(false);
  });

  test("names a failed Frontier season in health until a launcher continues it", async () => {
    const { app, store } = createApp(signedOut);
    const season = await scheduleFrontierSeason(store, "2027-01-01T00:00:00.000Z");
    const started = (await store.startNext(Date.now()))!;
    await store.fail(started.id, "rpc down");
    const failedRuns = async () =>
      ((await (await app.request("https://play.realms.party/api/factory/health")).json()) as { failedRuns: unknown[] })
        .failedRuns;
    expect(await failedRuns()).toEqual([
      expect.objectContaining({ environment: "madara.frontier", name: season.name, error: "rpc down" }),
    ]);
    await store.enqueue("game", season.request);
    expect(await failedRuns()).toEqual([]);
  });
});
