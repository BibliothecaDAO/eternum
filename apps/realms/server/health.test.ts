import { expect, it, vi } from "vitest";
import { routeIdentityRequest } from "./routes";
import type { IdentityEnv } from "./env";
import type { IdentityAuth } from "./auth";

it("checks account storage and chat SQL without a session, exposing no rows and failing loudly", async () => {
  const all = vi.fn(async () => ({ results: [{ id: "private" }] }));
  const health = vi.fn(async () => ({ success: true }));
  const env = {
    DB: { prepare: () => ({ all }) },
    CHAT_ROOM: { idFromName: vi.fn((name) => name), get: () => ({ health }) },
  } as unknown as IdentityEnv;
  const read = (path: string) =>
    routeIdentityRequest(
      new Request("https://play.test" + path),
      env,
      {} as IdentityAuth,
      {} as Parameters<typeof routeIdentityRequest>[3],
    );
  for (const path of ["/api/health/accounts", "/api/chat/health"]) {
    const response = await read(path);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ success: true });
  }
  expect(env.CHAT_ROOM.idFromName).toHaveBeenCalledWith("world:global");
  all.mockRejectedValue(new Error("storage failed"));
  health.mockRejectedValue(new Error("object unavailable"));
  for (const path of ["/api/health/accounts", "/api/chat/health"]) {
    const response = await read(path);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false });
  }
});
