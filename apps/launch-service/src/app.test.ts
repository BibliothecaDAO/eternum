import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";
import { createLaunchApp } from "./app";
import type { IdentityResolver } from "./auth";
import { InMemoryLaunchStore } from "./test-store";
import type { SlotStore } from "./slots";

const ALLOWED_ORIGIN = "https://play.realms.party";
const ALLOWED_ADDRESS = "0x123";

const identity = (address: string | null): IdentityResolver => ({
  resolve: () => Effect.succeed(address ? { address } : null),
});

const slotStore = (): SlotStore => ({
  create: vi.fn(),
  list: vi.fn().mockResolvedValue([]),
  register: vi.fn(),
  freeze: vi.fn(),
  freezeNextDue: vi.fn(),
});

const createApp = (
  resolver: IdentityResolver,
  store = new InMemoryLaunchStore(),
  allowAnyLauncher = false,
  slots = slotStore(),
  verifyPlayer = vi.fn(async (_owner: string) => {}),
) => ({
  app: createLaunchApp({
    config: {
      allowedOrigins: new Set([ALLOWED_ORIGIN]),
      allowAnyLauncher,
      launcherAllowlist: new Set([ALLOWED_ADDRESS]),
    },
    identity: resolver,
    store,
    slots,
    verifyPlayer,
  }),
  store,
  slots,
  verifyPlayer,
});

describe("free slot registration", () => {
  const registerRequest = () =>
    new Request("http://launch.test/api/slots/friday/register", {
      method: "POST",
      headers: {
        origin: ALLOWED_ORIGIN,
        cookie: "better-auth.session_token=valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ owner: "0xdead", account: "0xbeef" }),
    });

  test("binds registration to the verified identity, without requiring launcher privileges", async () => {
    const { app, slots, verifyPlayer } = createApp(identity("0x456"));
    const response = await app.request(registerRequest());
    expect(response.status).toBe(200);
    expect(slots.register).toHaveBeenCalledTimes(1);
    expect(slots.register).toHaveBeenCalledWith("friday", "0x456");
    expect(verifyPlayer).toHaveBeenCalledWith("0x456");
  });

  test("does not freeze an unbound identity into the roster", async () => {
    const slots = slotStore();
    const { app } = createApp(
      identity("0x456"),
      new InMemoryLaunchStore(),
      false,
      slots,
      vi.fn(async () => {
        throw new Error("Identity has no gameplay account");
      }),
    );
    expect((await app.request(registerRequest())).status).toBe(503);
    expect(slots.register).not.toHaveBeenCalled();
  });

  test("does not register unauthenticated or cross-origin requests", async () => {
    const { app, slots } = createApp(identity(null));
    expect((await app.request(registerRequest())).status).toBe(401);
    const request = registerRequest();
    request.headers.set("origin", "https://untrusted.example");
    expect((await app.request(request)).status).toBe(403);
    expect(slots.register).not.toHaveBeenCalled();
  });

  test("only launchers can create or close slots", async () => {
    const { app, slots } = createApp(identity("0x456"));
    for (const path of ["/api/slots", "/api/slots/friday/close"]) {
      const response = await app.request(
        new Request(`http://launch.test${path}`, {
          method: "POST",
          headers: registerRequest().headers,
          body: JSON.stringify({ name: "friday", closesAt: "2099-01-01T00:00:00Z" }),
        }),
      );
      expect(response.status).toBe(403);
    }
    expect(slots.create).not.toHaveBeenCalled();
    expect(slots.freeze).not.toHaveBeenCalled();
  });

  test("slot reads need no wallet and malformed schedules do not reach storage", async () => {
    const { app, slots } = createApp(identity(ALLOWED_ADDRESS));
    expect(await (await app.request("http://launch.test/api/slots")).json()).toEqual({ slots: [] });
    const response = await app.request(
      new Request("http://launch.test/api/slots", {
        method: "POST",
        headers: registerRequest().headers,
        body: JSON.stringify({ name: "friday", closesAt: "not a date" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(slots.create).not.toHaveBeenCalled();
  });
});

const launchRequest = () =>
  new Request("http://launch.test/api/factory/runs", {
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
    const { app } = createApp(identity(null));
    const response = await app.request(launchRequest());
    expect(response.status).toBe(401);
  });

  test("rejects an allowlisted session from a spoofed or omitted origin", async () => {
    const { app } = createApp(identity(ALLOWED_ADDRESS));
    const spoofed = launchRequest();
    spoofed.headers.set("origin", "https://attacker.example");
    expect((await app.request(spoofed)).status).toBe(403);

    const omitted = launchRequest();
    omitted.headers.delete("origin");
    expect((await app.request(omitted)).status).toBe(403);
  });

  test("rejects a signed-in address outside the launcher allowlist", async () => {
    const { app } = createApp(identity("0x456"));
    expect((await app.request(launchRequest())).status).toBe(403);
  });

  test("with a wildcard allowlist, any verified session may launch", async () => {
    const { app } = createApp(identity("0x456"), new InMemoryLaunchStore(), true);
    expect((await app.request(launchRequest())).status).toBe(202);
  });

  test("returns the requested format when launching and listing Eternum games", async () => {
    const { app } = createApp(identity(ALLOWED_ADDRESS));
    const request = launchRequest();
    const response = await app.request(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({ environment: "madara.eternum", gameName: "eternum-factory-test", version: "1" }),
      }),
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ gameType: "eternum", environment: "madara.eternum" });
    const listed = await app.request("http://launch.test/api/factory/runs?environment=madara.eternum");
    expect(await listed.json()).toMatchObject({ runs: [{ gameType: "eternum", gameName: "eternum-factory-test" }] });
  });

  test("queues an authorized launch and keeps reads public", async () => {
    const { app } = createApp(identity(ALLOWED_ADDRESS));
    const created = await app.request(launchRequest());
    expect(created.status).toBe(202);
    expect(await created.json()).toMatchObject({
      environment: "madara.blitz",
      gameName: "bltz-effect-test",
      status: "running",
      workflow: { workflowName: "box-native" },
    });

    const listed = await app.request("http://launch.test/api/factory/runs?environment=madara.blitz");
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({ runs: [{ gameName: "bltz-effect-test" }] });
  });

  test("exposes public reads only to allowlisted browser origins", async () => {
    const { app } = createApp(identity(null));
    const allowed = await app.request("http://launch.test/api/factory/runs?environment=madara.blitz", {
      headers: { origin: ALLOWED_ORIGIN },
    });
    const disallowed = await app.request("http://launch.test/api/factory/runs?environment=madara.blitz", {
      headers: { origin: "https://attacker.example" },
    });

    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(disallowed.status).toBe(200);
    expect(disallowed.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("rejects an unregistered registrar preset", async () => {
    const { app } = createApp(identity(ALLOWED_ADDRESS));
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

  test("launches a Duel on preset 3 and stores version:3", async () => {
    const { app, store } = createApp(identity(ALLOWED_ADDRESS));
    const request = launchRequest();
    request.headers.set("content-type", "application/json");
    const duel = new Request(request, {
      body: JSON.stringify({
        environment: "madara.blitz",
        gameName: "bltz-duel-game",
        version: "3",
        twoPlayerMode: true,
        devModeOn: false,
      }),
    });

    expect((await app.request(duel)).status).toBe(202);
    const run = await store.find("game", "madara.blitz", "bltz-duel-game");
    expect(run && "version" in run.request ? run.request.version : undefined).toBe("3");
  });

  test("launches a real game dev-off and stores devModeOn:false", async () => {
    const { app, store } = createApp(identity(ALLOWED_ADDRESS));
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
});
