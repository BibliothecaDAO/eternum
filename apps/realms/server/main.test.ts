import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bindGameplayAccount: vi.fn(),
  getSession: vi.fn(),
  serveStatic: vi.fn(),
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

import { handleRequest } from "./main";

describe("identity request router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ session: { id: "session" }, user: { id: "0x1" } });
    mocks.serveStatic.mockResolvedValue(new Response("spa", { headers: { "content-type": "text/html" } }));
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
