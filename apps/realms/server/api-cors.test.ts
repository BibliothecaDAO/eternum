import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  serverEnv: {
    VITE_BASE_URL: "https://app.realms.party",
    VITE_PUBLIC_GAME_ORIGIN: "https://play.realms.party",
  },
}));

import { handleApiCors } from "./api-cors";

describe("handleApiCors", () => {
  it.each(["https://app.realms.party", "https://play.realms.party"])("echoes the allowed origin %s", async (origin) => {
    const response = await handleApiCors(request("GET", origin), () => Response.json({ session: true }));

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("answers preflight without calling the route", async () => {
    const route = vi.fn(() => new Response());
    const response = await handleApiCors(request("OPTIONS", "https://play.realms.party"), route);

    expect(route).not.toHaveBeenCalled();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://play.realms.party");
  });

  it("rejects an untrusted cross-origin request", async () => {
    const response = await handleApiCors(request("POST", "https://attacker.invalid"), () => new Response());

    expect(response.status).toBe(403);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  });

  it("allows a same-origin request without an Origin header", async () => {
    const response = await handleApiCors(new Request("https://app.realms.party/api/leaderboard"), () =>
      Response.json({ players: [] }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  });
});

function request(method: string, origin: string): Request {
  return new Request("https://app.realms.party/api/auth/get-session", { method, headers: { origin } });
}
