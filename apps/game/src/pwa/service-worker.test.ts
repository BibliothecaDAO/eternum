// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const cache = vi.hoisted(() => ({ match: vi.fn(), precache: vi.fn(), cleanup: vi.fn() }));
vi.mock("workbox-precaching", () => ({
  matchPrecache: cache.match,
  precacheAndRoute: cache.precache,
  cleanupOutdatedCaches: cache.cleanup,
}));
const listeners = new Map<string, (event: any) => void>();
const network = vi.fn();
const skipWaiting = vi.fn().mockResolvedValue(undefined);

beforeEach(async () => {
  vi.resetModules();
  listeners.clear();
  vi.stubGlobal("self", {
    location: { origin: "https://game.test" },
    __WB_MANIFEST: [],
    skipWaiting,
    addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener),
  });
  vi.stubGlobal("fetch", network);
  await import("../sw");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function navigate(path: string, mode = "navigate") {
  const respondWith = vi.fn();
  listeners.get("fetch")!({ request: { url: `https://game.test${path}`, mode }, respondWith });
  return respondWith;
}

it("fetches current online HTML without caching it", async () => {
  const response = new Response("current shell");
  network.mockResolvedValue(response);
  expect(await navigate("/play/madara/game/map").mock.calls[0][0]).toBe(response);
  expect(network).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
  );
  expect(cache.match).not.toHaveBeenCalled();
});

it("uses only the offline document when navigation fails or the server is unavailable", async () => {
  const offline = new Response("offline shell");
  cache.match.mockResolvedValue(offline);
  network
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  expect(await navigate("/").mock.calls[0][0]).toBe(offline);
  expect(await navigate("/index.html").mock.calls[0][0]).toBe(offline);
  expect(cache.match).toHaveBeenCalledWith("offline.html");
});

it("leaves API navigation, game assets and data fetches on the network", () => {
  expect(navigate("/api/session")).not.toHaveBeenCalled();
  expect(navigate("/models/army.glb", "cors")).not.toHaveBeenCalled();
  expect(navigate("/play/madara/game/map", "cors")).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});

it("preserves authorization failures and missing-page responses", async () => {
  for (const status of [401, 404]) {
    network.mockResolvedValue(new Response("error", { status }));
    expect((await navigate("/factory").mock.calls[0][0]).status).toBe(status);
  }
  expect(cache.match).not.toHaveBeenCalled();
});

it("activates early only for the explicit update message", () => {
  const waitUntil = vi.fn();
  expect(skipWaiting).not.toHaveBeenCalled();
  listeners.get("message")!({ data: { type: "OTHER" }, waitUntil });
  expect(waitUntil).not.toHaveBeenCalled();
  listeners.get("message")!({ data: { type: "SKIP_WAITING" }, waitUntil });
  expect(skipWaiting).toHaveBeenCalledOnce();
  expect(waitUntil).toHaveBeenCalledOnce();
});
