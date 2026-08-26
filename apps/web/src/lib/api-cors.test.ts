import { describe, expect, it } from "vitest";

import { handleApiCors } from "./api-cors";

const GAME_ORIGIN = "https://play.realms.test";

describe("handleApiCors", () => {
  it("answers the game preflight without calling the route", async () => {
    let called = false;
    const response = await handleApiCors(request("OPTIONS", GAME_ORIGIN), () => {
      called = true;
      return new Response();
    });

    expect(called).toBe(false);
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(GAME_ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("adds credentials CORS headers to an API response", async () => {
    const response = await handleApiCors(request("GET", GAME_ORIGIN), () => Response.json({ session: true }));

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(GAME_ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("rejects an untrusted cross-origin request", async () => {
    const response = await handleApiCors(request("POST", "https://attacker.invalid"), () => new Response());

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBe(GAME_ORIGIN);
  });
});

function request(method: string, origin: string): Request {
  return new Request("https://realms.test/api/auth/get-session", { method, headers: { origin } });
}
