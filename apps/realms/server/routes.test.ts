import { beforeEach, expect, it, vi } from "vitest";
import type { IdentityEnv } from "./env";
import type { IdentityAuth } from "./auth";

const handlers = vi.hoisted(() => ({ directory: vi.fn(), devices: vi.fn(), chat: vi.fn() }));
vi.mock("./directory", () => ({
  handleDirectory: handlers.directory,
  handleDirectoryHistory: handlers.directory,
  handleAdmitShard: vi.fn(),
  handleShardStatus: vi.fn(),
}));
vi.mock("./devices", () => ({ handleDeviceChange: handlers.devices, handleBotDeviceApproval: vi.fn() }));
vi.mock("./chat/routes", () => ({ routeChat: handlers.chat }));
import { routeIdentityRequest } from "./routes";

const limiter = (limit: number) => {
  const counts = new Map<string, number>();
  return {
    limit: vi.fn(async ({ key }: { key: string }) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return { success: count <= limit };
    }),
  };
};
const origin = "https://play.realms.party";
const platform = {} as Parameters<typeof routeIdentityRequest>[3];
let env: IdentityEnv;
const auth = {} as IdentityAuth;
beforeEach(() => {
  vi.clearAllMocks();
  env = { BASE_URL: origin, PUBLIC_RATE_LIMIT: limiter(30), DIRECTORY_RATE_LIMIT: limiter(600) } as IdentityEnv;
  handlers.directory.mockImplementation(async () => Response.json({ shards: [] }));
  handlers.devices.mockImplementation(async () => Response.json({ signature: [] }));
  handlers.chat.mockImplementation(async () => Response.json({ blocked: [] }));
});

it("allows 100 viewers behind one IP to poll four times and read history twice each minute", async () => {
  for (let request = 0; request < 600; request += 1) {
    const path = request % 3 === 0 ? "/api/directory/history" : "/api/directory";
    const response = await routeIdentityRequest(
      new Request(origin + path, { headers: { "cf-connecting-ip": "192.0.2.1" } }),
      env,
      auth,
      platform,
    );
    expect(response.status).toBe(200);
  }
  expect(
    (
      await routeIdentityRequest(
        new Request(origin + "/api/directory", { headers: { "cf-connecting-ip": "192.0.2.1" } }),
        env,
        auth,
        platform,
      )
    ).status,
  ).toBe(429);
});
