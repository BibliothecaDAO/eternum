import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: "0x1" as string | null,
  register: vi.fn(),
  revoke: vi.fn(),
  send: vi.fn(),
  worker: vi.fn(),
  permission: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  subscription: null as any,
  device: null as any,
}));
vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: {
    registerPushSubscription: mocks.register,
    revokePushSubscription: mocks.revoke,
    sendPushTest: mocks.send,
  },
  useIdentitySessionStore: { getState: () => ({ session: mocks.owner ? { user: { id: mocks.owner } } : null }) },
}));
vi.mock("./local-notification-client", () => ({ notificationWorkerRequest: mocks.worker }));
import {
  disablePushNotifications,
  enablePushNotifications,
  reconcilePushAccount,
  sendBackgroundPushTest,
} from "./push-notification-client";
const id = "11111111-1111-4111-8111-111111111111";
const subscriptionJson = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner = "0x1";
  mocks.device = null;
  mocks.subscription = null;
  mocks.register.mockReset().mockResolvedValue({ id });
  mocks.revoke.mockReset().mockResolvedValue({ revoked: true });
  mocks.send.mockResolvedValue({ status: "accepted" });
  mocks.permission.mockResolvedValue("granted");
  mocks.unsubscribe.mockResolvedValue(true);
  mocks.subscribe.mockImplementation(
    async () => (mocks.subscription = { toJSON: () => subscriptionJson, unsubscribe: mocks.unsubscribe }),
  );
  mocks.worker.mockImplementation(async (owner: string, action: string, input: any) => {
    if (action === "push-status") return mocks.device;
    if (action === "prepare-push")
      return (mocks.device = { owner, id, token: id, enabledAt: Date.now(), state: "preparing" });
    if (action === "activate-push") {
      if (!mocks.device || mocks.device.state === "revoking") throw Error("revoked");
      mocks.device.state = "active";
    }
    if (action === "revoke-push") {
      if (mocks.device?.owner !== owner) return null;
      mocks.device.state = "revoking";
      return mocks.device;
    }
    if (action === "forget-push" && input.id === mocks.device?.id) mocks.device = null;
    return null;
  });
  vi.stubGlobal("Notification", { permission: "default", requestPermission: mocks.permission });
  vi.stubGlobal("navigator", {
    locks: { request: async (_: string, work: () => Promise<void>) => work() },
    serviceWorker: {
      getRegistration: async () => ({
        active: {},
        pushManager: { getSubscription: async () => mocks.subscription, subscribe: mocks.subscribe },
      }),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
it("requests permission in the click gesture and activates only after authenticated registration", async () => {
  let finish!: () => void;
  mocks.register.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const work = enablePushNotifications("0x1", "BAAA");
  expect(mocks.permission).toHaveBeenCalledOnce();
  await vi.waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
  expect(mocks.device.state).toBe("preparing");
  finish();
  await work;
  expect(mocks.device.state).toBe("active");
  expect(mocks.register).toHaveBeenCalledWith({ owner: "0x1", id, token: id, subscription: subscriptionJson });
});
it("revokes setup if the account changes during server registration", async () => {
  mocks.register.mockImplementation(async () => {
    mocks.owner = "0x2";
  });
  await expect(enablePushNotifications("0x1", "BAAA")).rejects.toThrow("account changed");
  expect(mocks.revoke).toHaveBeenCalledWith(id, id);
  expect(mocks.device).toBeNull();
  expect(mocks.unsubscribe).toHaveBeenCalledOnce();
});
it("persists local revocation before a failing network call and retries it after logout", async () => {
  await enablePushNotifications("0x1", "BAAA");
  mocks.revoke.mockRejectedValueOnce(new Error("Offline"));
  await expect(disablePushNotifications("0x1")).rejects.toThrow("Offline");
  expect(mocks.device.state).toBe("revoking");
  expect(mocks.unsubscribe).not.toHaveBeenCalled();
  mocks.owner = null;
  await reconcilePushAccount();
  expect(mocks.device).toBeNull();
  expect(mocks.revoke).toHaveBeenCalledTimes(2);
});
it("never creates a subscription after permission denial", async () => {
  mocks.permission.mockResolvedValue("denied");
  await expect(enablePushNotifications("0x1", "BAAA")).rejects.toThrow("permission");
  expect(mocks.subscribe).not.toHaveBeenCalled();
  expect(mocks.register).not.toHaveBeenCalled();
});
it("sends a test only for the active account's acknowledged registration", async () => {
  await expect(sendBackgroundPushTest("0x1", "/enter/madara/game")).rejects.toThrow();
  await enablePushNotifications("0x1", "BAAA");
  await sendBackgroundPushTest("0x1", "/enter/madara/game");
  expect(mocks.send).toHaveBeenCalledWith("0x1", id, "/enter/madara/game");
  mocks.owner = "0x2";
  await expect(sendBackgroundPushTest("0x1", "/enter/madara/game")).rejects.toThrow();
  expect(mocks.send).toHaveBeenCalledOnce();
});

it("does not revoke a new account when an earlier reconciliation finishes late", async () => {
  const device = { owner: "0x2", id, token: id, state: "active" };
  let finish!: (value: unknown) => void;
  mocks.worker.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const work = reconcilePushAccount();
  await vi.waitFor(() => expect(mocks.worker).toHaveBeenCalledOnce());
  mocks.owner = "0x2";
  mocks.device = device;
  finish(device);
  await work;
  expect(mocks.revoke).not.toHaveBeenCalled();
  expect(mocks.device.state).toBe("active");
});

it("does not report a failed detach for an older worker with no push subscription", async () => {
  mocks.worker.mockRejectedValue(new Error("Unknown notification command"));
  await expect(reconcilePushAccount()).resolves.toBeUndefined();
  mocks.subscription = {};
  await expect(reconcilePushAccount()).rejects.toThrow("Unknown notification command");
});
