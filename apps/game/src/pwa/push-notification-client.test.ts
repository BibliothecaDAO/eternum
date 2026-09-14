import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: "0x1" as string | null,
  register: vi.fn(),
  revoke: vi.fn(),
  send: vi.fn(),
  status: vi.fn(),
  foreground: vi.fn(),
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
    getPushSubscriptionStatus: mocks.status,
    setPushGameForeground: mocks.foreground,
  },
  useIdentitySessionStore: { getState: () => ({ session: mocks.owner ? { user: { id: mocks.owner } } : null }) },
}));
vi.mock("./local-notification-client", () => ({ notificationWorkerRequest: mocks.worker }));
import {
  disablePushNotifications,
  enablePushNotifications,
  reconcilePushAccount,
  sendBackgroundPushTest,
  syncPushGameForeground,
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
  mocks.status.mockReset().mockResolvedValue({ registered: true, automatic: null });
  mocks.foreground.mockReset().mockResolvedValue({ foreground: true });
  mocks.permission.mockResolvedValue("granted");
  mocks.unsubscribe.mockResolvedValue(true);
  mocks.subscribe.mockImplementation(
    async () => (mocks.subscription = { toJSON: () => subscriptionJson, unsubscribe: mocks.unsubscribe }),
  );
  mocks.worker.mockImplementation(async (owner: string, action: string, input: any) => {
    if (action === "push-capabilities")
      return { automaticGameAlerts: true, directMessageAlerts: true, gameForegroundLease: true };
    if (action === "push-status") return mocks.device;
    if (action === "game-foreground-status") return true;
    if (action === "prepare-push")
      return (mocks.device ??= { owner, id, token: id, enabledAt: Date.now(), state: "preparing" });
    if (action === "activate-push") {
      if (!mocks.device || mocks.device.state === "revoking") throw Error("revoked");
      mocks.device.state = "active";
    }
    if (action === "prepare-automatic") mocks.device.automatic = { ...input.source, acknowledged: false };
    if (action === "acknowledge-automatic") {
      if (mocks.device?.state !== "active") throw Error("revoked");
      mocks.device.automatic.acknowledged = true;
    }
    if (action === "revoke-push") {
      if (mocks.device?.owner !== owner || (input?.id && input.id !== mocks.device.id)) return null;
      mocks.device.state = "revoking";
      return mocks.device;
    }
    if (action === "forget-push" && input.id === mocks.device?.id) mocks.device = null;
    return null;
  });
  vi.stubGlobal("Notification", { permission: "default", requestPermission: mocks.permission });
  vi.stubGlobal("navigator", {
    locks: { request: serializedLock() },
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

it("reports visible gameplay for any active push device", async () => {
  await syncPushGameForeground("0x1");
  expect(mocks.foreground).not.toHaveBeenCalled();
  mocks.device = {
    owner: "0x1",
    id,
    token: id,
    state: "active",
  };
  await syncPushGameForeground("0x1");
  expect(mocks.worker).toHaveBeenCalledWith("0x1", "game-foreground-status");
  expect(mocks.foreground).toHaveBeenCalledWith("0x1", id, true);
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

it("enables the worker before opting the server registration into game alerts", async () => {
  const enabled: boolean[] = [];
  mocks.register.mockImplementation(async (input) => {
    enabled.push(input.gameAlerts === true);
    if (input.gameAlerts) expect(mocks.device.automatic.acknowledged).toBe(false);
    return { id };
  });
  await enablePushNotifications("0x1", "BAAA", { chain: "madara", worldAddress: "0x123" });
  expect(enabled).toEqual([false, true]);
});
it("requires a compatible worker before upgrading a preview subscription", async () => {
  mocks.worker.mockRejectedValue(new Error("Unknown notification command"));
  await expect(enablePushNotifications("0x1", "BAAA", { chain: "madara", worldAddress: "0x123" })).rejects.toThrow(
    "latest game update",
  );
  expect(mocks.register).not.toHaveBeenCalled();
  expect(mocks.revoke).not.toHaveBeenCalled();
});

it("requires foreground-aware worker support before enabling direct-message alerts", async () => {
  mocks.worker.mockImplementation(async (_owner: string, action: string) => {
    if (action === "push-capabilities")
      return { automaticGameAlerts: true, directMessageAlerts: false, gameForegroundLease: true };
    return null;
  });
  await expect(enablePushNotifications("0x1", "BAAA", null, true)).rejects.toThrow("latest game update");
  expect(mocks.register).not.toHaveBeenCalled();
});

it.each([false, true])(
  "recovers interrupted automatic setup after reopen (server acknowledged: %s)",
  async (acknowledged) => {
    const source = { chain: "madara", worldAddress: "0x123" };
    mocks.device = { owner: "0x1", id, token: id, state: "active", automatic: { ...source, acknowledged: false } };
    mocks.subscription = { toJSON: () => subscriptionJson, unsubscribe: mocks.unsubscribe };
    mocks.status.mockResolvedValue({ registered: true, automatic: acknowledged ? source : null });
    await reconcilePushAccount();
    expect(mocks.device.automatic.acknowledged).toBe(true);
    expect(mocks.register).toHaveBeenCalledTimes(acknowledged ? 0 : 1);
  },
);

function serializedLock() {
  let tail = Promise.resolve();
  return (_name: string, work: () => Promise<void>) => {
    const next = tail.then(work);
    tail = next.catch(() => {});
    return next;
  };
}

it.each(["logout", "switch", "disable"] as const)(
  "revokes locally on %s while automatic recovery holds the network lock",
  async (action) => {
    const source = { chain: "madara", worldAddress: "0x123" };
    mocks.device = { owner: "0x1", id, token: id, state: "active", automatic: { ...source, acknowledged: false } };
    let finish!: (value: unknown) => void;
    mocks.status.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const recovering = reconcilePushAccount();
    const failedRecovery = expect(recovering).rejects.toThrow();
    await vi.waitFor(() => expect(mocks.status).toHaveBeenCalledOnce());
    if (action !== "disable") mocks.owner = action === "logout" ? null : "0x2";
    const removal = action === "disable" ? disablePushNotifications("0x1") : reconcilePushAccount();
    try {
      await vi.waitFor(() => expect(mocks.device.state).toBe("revoking"));
      expect(mocks.revoke).not.toHaveBeenCalled();
    } finally {
      finish({ registered: true, automatic: source });
      await failedRecovery;
      await removal;
    }
    expect(mocks.device).toBeNull();
  },
);

it("does not activate a registration disabled while its server write is stalled", async () => {
  let finish!: () => void;
  mocks.register.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const setup = enablePushNotifications("0x1", "BAAA");
  const failedSetup = expect(setup).rejects.toThrow();
  await vi.waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
  const removal = disablePushNotifications("0x1");
  try {
    await vi.waitFor(() => expect(mocks.device.state).toBe("revoking"));
  } finally {
    finish();
    await failedSetup;
    await removal;
  }
  expect(mocks.device).toBeNull();
});

it("does not unsubscribe a replacement when queued cleanup resumes", async () => {
  const old = { owner: "0x1", id, token: id, state: "active" };
  mocks.device = old;
  let resume!: () => void;
  navigator.locks.request = vi.fn(
    (_name: string, work: () => Promise<void>) =>
      new Promise<void>((resolve) => {
        resume = () => {
          void work().then(resolve);
        };
      }),
  ) as typeof navigator.locks.request;
  const removal = disablePushNotifications("0x1");
  await vi.waitFor(() => expect(mocks.device.state).toBe("revoking"));
  const replacement = { ...old, id: "22222222-2222-4222-8222-222222222222", state: "active" };
  mocks.device = replacement;
  resume();
  await removal;
  expect(mocks.revoke).toHaveBeenCalledWith(id, id);
  expect(mocks.unsubscribe).not.toHaveBeenCalled();
  expect(mocks.device).toBe(replacement);
});
