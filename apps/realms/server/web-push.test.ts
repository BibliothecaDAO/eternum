import { afterEach, expect, it, vi } from "vitest";
import { buildDayEndReminder, type PushEnvelope } from "@bibliothecadao/notifications";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { sendPush } from "./web-push";

vi.mock("@block65/webcrypto-web-push", () => ({ buildPushPayload: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

const now = 1_800_000_000_000;
const notification = () =>
  buildDayEndReminder({
    chainId: "0xa",
    worldAddress: "0x123",
    gameId: 1,
    day: 0,
    owner: "0x1",
    endsAt: now / 1000 + 3600,
    tomorrowSeconds: 12 * 3600,
  });
const envelope = (): PushEnvelope => ({
  version: 1,
  kind: "game",
  subscriptionId: "00000000-0000-4000-8000-000000000001",
  notification: notification(),
});
const vapid = { publicKey: "public", privateKey: "private", subject: "mailto:push@realms.world" };
const device = { endpoint: "https://push.test/one", p256dh: "key", auth: "auth" };

it("uses immediate-only push TTL for the reminder rather than storing it for two minutes", async () => {
  vi.spyOn(Date, "now").mockReturnValue(now);
  vi.mocked(buildPushPayload).mockResolvedValue({ method: "POST", headers: {}, body: "encrypted" } as never);
  const fetchPush = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
  expect(await sendPush(vapid, device, envelope(), fetchPush)).toBe("accepted");
  expect(buildPushPayload).toHaveBeenCalledWith(
    expect.objectContaining({ options: { ttl: 0, urgency: "high" } }),
    expect.anything(),
    vapid,
  );
  expect(fetchPush).toHaveBeenCalledOnce();
});

it("drops a reminder if encryption crosses its delivery deadline", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  vi.mocked(buildPushPayload).mockImplementation(async () => {
    clock.mockReturnValue(now + 1000);
    return { method: "POST", headers: {}, body: "encrypted" } as never;
  });
  const fetchPush = vi.fn();
  expect(await sendPush(vapid, device, envelope(), fetchPush)).toBe("rejected");
  expect(fetchPush).not.toHaveBeenCalled();
});

it("abandons a stalled push request at expiry so later alarms are not held behind it", async () => {
  vi.spyOn(Date, "now").mockReturnValue(now + 999);
  vi.mocked(buildPushPayload).mockResolvedValue({ method: "POST", headers: {}, body: "encrypted" } as never);
  const fetchPush: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      if (!init?.signal) return reject(new Error("Missing delivery deadline"));
      init.signal.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
    });
  await expect(sendPush(vapid, device, envelope(), fetchPush)).rejects.toHaveProperty("name", "TimeoutError");
});
