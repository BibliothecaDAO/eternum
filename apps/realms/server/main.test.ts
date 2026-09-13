vi.mock("@realms-world/db/client", () => ({ db: {} }));
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bindGameplayAccount: vi.fn(),
  getSession: vi.fn(),
  serveStatic: vi.fn(),
  readPreferences: vi.fn(),
  savePreferences: vi.fn(),
}));

vi.mock("./auth", () => ({
  auth: {
    api: { getSession: mocks.getSession },
    handler: vi.fn(() => Response.json({ auth: true })),
  },
}));
vi.mock("./binding", () => ({
  BindGameplayAccountInput: { parse: (input: unknown) => input },
  RotateGameplayAccountInput: { parse: (input: unknown) => input },
  bindGameplayAccount: mocks.bindGameplayAccount,
  gameplayAccountOf: vi.fn(() => null),
  rotateGameplayAccountKey: vi.fn(),
}));
vi.mock("./env", () => ({
  serverEnv: {
    REALMS_SERVER_PORT: 3000,
    VITE_BASE_URL: "https://app.realms.party",
    VITE_PUBLIC_GAME_ORIGIN: "https://play.realms.party",
  },
}));
vi.mock("./names", () => ({
  leaderboardPopulation: vi.fn(() => []),
}));
vi.mock("./profiles", () => ({
  profilesByAccounts: vi.fn(async (accounts: string[]) =>
    Object.fromEntries(accounts.map((account) => [account, { name: `lord-${account}`, portrait: "02" }])),
  ),
}));
vi.mock("./static", () => ({ serveStatic: mocks.serveStatic }));
vi.mock("./notification-preference-store", async () => {
  const { Context, Effect, Layer } = await import("effect");
  class NotificationPreferenceStore extends Context.Service<
    NotificationPreferenceStore,
    {
      read: (owner: string) => ReturnType<typeof Effect.promise>;
      save: (owner: string, level: string, revision: number) => ReturnType<typeof Effect.promise>;
    }
  >()("NotificationPreferenceStore") {
    static readonly layer = Layer.succeed(NotificationPreferenceStore, {
      read: (owner) => Effect.promise(() => mocks.readPreferences(owner)),
      save: (owner, level, revision) => Effect.promise(() => mocks.savePreferences(owner, level, revision)),
    });
  }
  return { NotificationPreferenceStore };
});

import { handleRequest } from "./main";

describe("identity request router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ session: { id: "session" }, user: { id: "0x1" } });
    mocks.serveStatic.mockResolvedValue(new Response("spa", { headers: { "content-type": "text/html" } }));
  });

  it("authenticates preference reads, disables cookie caching, and returns private no-store responses", async () => {
    mocks.readPreferences.mockResolvedValue({ owner: "0x1", level: "off", revision: 0 });
    const request = new Request("https://app.realms.party/api/notifications/preferences", {
      headers: { origin: "https://play.realms.party" },
    });
    const response = await handleRequest(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(mocks.getSession).toHaveBeenCalledWith({ headers: request.headers, query: { disableCookieCache: true } });
    mocks.getSession.mockResolvedValue(null);
    expect((await handleRequest(request)).status).toBe(401);
    expect(mocks.readPreferences).toHaveBeenCalledTimes(1);
  });

  it("saves only the session owner's revision and reports conflicts, invalid input, and foreign origins", async () => {
    const post = (body: unknown, origin = "https://play.realms.party") =>
      handleRequest(
        new Request("https://app.realms.party/api/notifications/preferences", {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    const change = { owner: "0x1", level: "important", revision: 2 };
    mocks.savePreferences.mockResolvedValue({ ...change, revision: 3 });
    expect((await post(change)).status).toBe(200);
    expect(mocks.savePreferences).toHaveBeenCalledWith("0x1", "important", 2);
    mocks.savePreferences.mockResolvedValue(null);
    expect((await post(change)).status).toBe(409);
    const calls = mocks.savePreferences.mock.calls.length;
    expect((await post({ ...change, owner: "0x2" })).status).toBe(403);
    expect((await post({ ...change, extra: true })).status).toBe(400);
    expect((await post({ ...change, revision: -1 })).status).toBe(400);
    expect((await post("x".repeat(1025))).status).toBe(400);
    expect((await post(change, "https://foreign.example")).status).toBe(403);
    mocks.getSession.mockResolvedValue(null);
    expect((await post(change)).status).toBe(401);
    expect(mocks.savePreferences).toHaveBeenCalledTimes(calls);
  });

  it("keeps an unknown API path as a credentialed JSON 404", async () => {
    const response = await handleRequest(
      new Request("https://app.realms.party/api/does-not-exist", {
        headers: { origin: "https://play.realms.party" },
      }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("access-control-allow-origin")).toBe("https://play.realms.party");
    expect(mocks.serveStatic).not.toHaveBeenCalled();
  });

  it("serves public batched profiles by gameplay account, capped at 200 addresses", async () => {
    const response = await handleRequest(new Request("https://app.realms.party/api/profiles?accounts=0x1,0x2"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      profiles: { "0x1": { name: "lord-0x1", portrait: "02" }, "0x2": { name: "lord-0x2", portrait: "02" } },
    });
    expect(mocks.getSession).not.toHaveBeenCalled();
    const empty = await handleRequest(new Request("https://app.realms.party/api/profiles"));
    expect(empty.status).toBe(400);
    const tooMany = Array.from({ length: 201 }, (_, index) => `0x${index}`).join(",");
    expect((await handleRequest(new Request(`https://app.realms.party/api/profiles?accounts=${tooMany}`))).status).toBe(
      400,
    );
    expect((await handleRequest(new Request("https://app.realms.party/api/names?owners=0x1"))).status).toBe(404);
  });

  it("rate-limits profile requests per client and keeps other clients unaffected", async () => {
    const ask = (client: string) =>
      handleRequest(new Request("https://app.realms.party/api/profiles?accounts=0x1"), client);
    for (let index = 0; index < 30; index += 1) expect((await ask("10.0.0.1")).status).toBe(200);
    expect((await ask("10.0.0.1")).status).toBe(429);
    expect((await ask("10.0.0.2")).status).toBe(200);
    const viaEdge = await handleRequest(
      new Request("https://app.realms.party/api/profiles?accounts=0x1", {
        headers: { "cf-connecting-ip": "10.0.0.1" },
      }),
      "10.0.0.3",
    );
    expect(viaEdge.status).toBe(429);
  });

  it("does not treat the API root as a client route", async () => {
    const response = await handleRequest(new Request("https://app.realms.party/api"));

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(mocks.serveStatic).not.toHaveBeenCalled();
  });

  it("routes an authenticated bind request through the authority service", async () => {
    mocks.bindGameplayAccount.mockResolvedValue({ account: "0x2", bound: true, transactionHash: "0x3" });

    const response = await handleRequest(
      new Request("https://app.realms.party/api/gameplay-account/bind", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://play.realms.party" },
        body: JSON.stringify({ gameplayAddress: "0x2", publicKey: "0x4" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.bindGameplayAccount).toHaveBeenCalledWith({
      gameplayAddress: "0x2",
      owner: "0x1",
      publicKey: "0x4",
    });
  });

  it("sends client routes to the SPA without involving the API", async () => {
    const response = await handleRequest(new Request("https://app.realms.party/profile/0x1"));

    expect(response.status).toBe(200);
    expect(mocks.serveStatic).toHaveBeenCalledWith(new URL("https://app.realms.party/profile/0x1"), "GET");
  });
});
