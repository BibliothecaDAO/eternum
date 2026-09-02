import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { createLaunchApp } from "./app";
import type { IdentityResolver } from "./auth";
import { InMemoryLaunchStore } from "./test-store";

const ALLOWED_ORIGIN = "https://play.realms.party";
const ALLOWED_ADDRESS = "0x123";

const identity = (address: string | null): IdentityResolver => ({
  resolve: () => Effect.succeed(address ? { address } : null),
});

const createApp = (resolver: IdentityResolver, store = new InMemoryLaunchStore(), allowAnyLauncher = false) => ({
  app: createLaunchApp({
    config: {
      allowedOrigins: new Set([ALLOWED_ORIGIN]),
      allowAnyLauncher,
      launcherAllowlist: new Set([ALLOWED_ADDRESS]),
    },
    identity: resolver,
    store,
  }),
  store,
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

  test("rejects non-dev or non-preset-6 Madara launches", async () => {
    const { app } = createApp(identity(ALLOWED_ADDRESS));
    const request = launchRequest();
    request.headers.set("content-type", "application/json");
    const invalid = new Request(request, {
      body: JSON.stringify({
        environment: "madara.blitz",
        gameName: "bltz-invalid-profile",
        devModeOn: false,
        version: "7",
      }),
    });

    expect((await app.request(invalid)).status).toBe(400);
  });
});
