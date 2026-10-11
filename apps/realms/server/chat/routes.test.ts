import { beforeEach, expect, it, vi } from "vitest";
import type { IdentityAuth } from "../auth";
import type { IdentityEnv } from "../env";
import { routeChat } from "./routes";

const access = vi.hoisted(() => ({ readRoomAccess: vi.fn(), requireRoomReadAccess: vi.fn(), gameRoomsOf: vi.fn() }));
vi.mock("./room-access", async (original) => ({ ...(await original<typeof import("./room-access")>()), ...access }));
vi.mock("./rooms", async (original) => ({
  ...(await original<typeof import("./rooms")>()),
  gameRoomsOf: access.gameRoomsOf,
}));

beforeEach(() => {
  vi.clearAllMocks();
  access.readRoomAccess.mockResolvedValue({ canWrite: true });
  access.gameRoomsOf.mockResolvedValue([]);
});

const fixture = () => {
  const limit = vi.fn().mockResolvedValue({ success: true });
  const fetch = vi.fn().mockResolvedValue(new Response("socket"));
  const object = { idFromName: (name: string) => name, get: () => ({ fetch }) };
  const env = { PUBLIC_RATE_LIMIT: { limit }, CHAT_ROOM: object, CHAT_INBOX: object } as unknown as IdentityEnv;
  const getSession = vi.fn().mockResolvedValue({ user: { id: "user", realmsId: "0x1", name: "Player" } });
  const auth = { api: { getSession } } as unknown as IdentityAuth;
  const open = (path: string) =>
    routeChat(new Request(`https://realms.test${path}`, { headers: { upgrade: "websocket" } }), env, auth, path);
  return { open, limit, fetch, getSession };
};

it.each(["/api/chat/rooms/slot:0xa:noon", "/api/chat/inbox"])(
  "limits %s admission before membership reads or socket allocation",
  async (path) => {
    const f = fixture();
    expect((await f.open(path)).status).toBe(200);
    const roomReads = access.readRoomAccess.mock.calls.length;
    const inboxReads = access.gameRoomsOf.mock.calls.length;
    f.limit.mockResolvedValueOnce({ success: false });
    const rejected = await f.open(path);
    expect(rejected.status).toBe(429);
    expect(await rejected.json()).toEqual({ error: "too_many_requests" });
    expect(f.limit).toHaveBeenNthCalledWith(2, { key: "chat-open:0x1" });
    expect(access.readRoomAccess).toHaveBeenCalledTimes(roomReads);
    expect(access.gameRoomsOf).toHaveBeenCalledTimes(inboxReads);
    expect(f.fetch).toHaveBeenCalledTimes(1);
    f.getSession.mockResolvedValueOnce({ user: { id: "other", realmsId: "0x2", name: "Other" } });
    expect((await f.open(path)).status).toBe(200);
    expect(f.limit).toHaveBeenLastCalledWith({ key: "chat-open:0x2" });
  },
);

it("authenticates before consuming the room-opening budget", async () => {
  const f = fixture();
  f.getSession.mockResolvedValue(null);
  expect((await f.open("/api/chat/rooms/global")).status).toBe(401);
  expect(f.limit).not.toHaveBeenCalled();
  expect(f.fetch).not.toHaveBeenCalled();
});
