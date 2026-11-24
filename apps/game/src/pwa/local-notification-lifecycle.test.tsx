import type { Session } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
  reconcilePushAccount: vi.fn(async () => {}),
  reconcileIosAppPush: vi.fn(async () => {}),
  listenForIosAppPushTaps: vi.fn(() => ({ remove: async () => {} })),
  useNotificationPreferences: vi.fn(),
  iosAppBridge: vi.fn(() => ({ isNativePlatform: () => true })),
}));

vi.mock("./push-notification-client", () => ({
  reconcilePushAccount: spies.reconcilePushAccount,
}));
vi.mock("./ios-app-push", () => ({
  reconcileIosAppPush: spies.reconcileIosAppPush,
  listenForIosAppPushTaps: spies.listenForIosAppPushTaps,
}));
vi.mock("./ios-app-bridge", () => ({
  iosAppBridge: spies.iosAppBridge,
}));
vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferences: spies.useNotificationPreferences,
}));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { LocalNotificationLifecycle } from "./local-notification-lifecycle";

const SESSION = {
  session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
  user: { id: "u", realmsId: "0x7", name: "Maelis", email: "you@mail.test", image: "04", emailVerified: true },
} as unknown as Session;

afterEach(() => {
  useIdentitySessionStore.getState().applySession(null);
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it("waits for identity session to settle before reconciling push or loading preferences", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(identityClient, "getSession").mockImplementation(() => new Promise(() => {}));
  useIdentitySessionStore.setState({ status: "anonymous", session: null, settled: false, error: null });
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<LocalNotificationLifecycle />));
  try {
    expect(spies.reconcilePushAccount).not.toHaveBeenCalled();
    expect(spies.reconcileIosAppPush).not.toHaveBeenCalled();
    expect(spies.useNotificationPreferences).not.toHaveBeenCalled();

    await act(async () => useIdentitySessionStore.getState().applySession(SESSION));
    expect(spies.reconcilePushAccount).toHaveBeenCalledTimes(1);
    expect(spies.reconcileIosAppPush).toHaveBeenCalledWith(expect.anything(), "0x7");
    expect(spies.useNotificationPreferences).toHaveBeenCalledWith("0x7");
  } finally {
    await act(async () => root.unmount());
  }
});
