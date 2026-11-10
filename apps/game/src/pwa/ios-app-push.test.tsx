import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useThisDevice } from "@/shell/profile/this-device";
import { pageNavigation } from "@/utils/page-navigation";
import type { Session } from "@realms-world/identity";

import { CHAT_ALERT_PRESSED, type ChatAlertPress } from "./chat-alert";
import { useChatAlertPresses } from "./chat-alert-press";
import {
  disableIosAppPush,
  enableIosAppPush,
  iosAppBridge,
  listenForIosAppPushTaps,
  readIosAppPushDevice,
  reconcileIosAppPush,
  tappedAlertOpening,
  type IosAppPushDevice,
} from "./ios-app-push";

const OWNER = "0xa1";
const OTHER = "0xb2";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** The token as the plugin hands it over: Capacitor writes APNs's bytes as uppercase hex. */
const TOKEN = "AB01".repeat(16);
const NEW_TOKEN = "CD02".repeat(16);
const CONFIGURATION = { enabled: true, publicKey: "key", gameAlerts: true, directMessages: true } as const;

const sessionOf = (realmsId: string) =>
  ({
    session: { id: "s", expiresAt: "2026-12-01T00:00:00Z", userId: realmsId },
    user: { id: realmsId, realmsId, name: "Player", email: "player@mail.test" },
  }) satisfies Session;
const signIn = (realmsId: string | null) =>
  useIdentitySessionStore.getState().applySession(realmsId ? sessionOf(realmsId) : null);

/**
 * The iOS app's push plugin as its page meets it, through Capacitor's bridge: what iOS answers when asked, the token
 * APNs gives at each registration, and the events the page listens to.
 */
const installApp = ({ permission = "prompt", answer = "granted", token = TOKEN } = {}) => {
  const state = { permission, token };
  const listeners = new Map<string, Set<(data: unknown) => void>>();
  const emit = (event: string, data: unknown) => listeners.get(event)?.forEach((listener) => listener(data));
  const calls: string[] = [];
  const bridge = {
    isNativePlatform: () => true,
    nativePromise: async (plugin: string, method: string) => {
      expect(plugin).toBe("PushNotifications");
      calls.push(method);
      if (method === "checkPermissions") return { receive: state.permission };
      if (method === "requestPermissions") {
        state.permission = answer;
        return { receive: answer };
      }
      if (method === "register") queueMicrotask(() => emit("registration", { value: state.token }));
      return undefined;
    },
    addListener: (plugin: string, event: string, callback: (data: unknown) => void) => {
      expect(plugin).toBe("PushNotifications");
      const set = listeners.get(event) ?? new Set();
      set.add(callback);
      listeners.set(event, set);
      return { remove: async () => void set.delete(callback) };
    },
  };
  (window as { Capacitor?: unknown }).Capacitor = bridge;
  return { state, emit, calls, bridge: iosAppBridge()!, listening: (event: string) => listeners.get(event)?.size ?? 0 };
};

let registered: MockInstance<typeof identityClient.registerPushSubscription>;
let revoked: MockInstance<typeof identityClient.revokePushSubscription>;
let alertsOn: MockInstance<typeof identityClient.sendAlertsOn>;
beforeEach(() => {
  registered = vi.spyOn(identityClient, "registerPushSubscription").mockResolvedValue({ id: "registered" });
  revoked = vi.spyOn(identityClient, "revokePushSubscription").mockResolvedValue({ revoked: true });
  alertsOn = vi.spyOn(identityClient, "sendAlertsOn").mockResolvedValue({ status: "accepted" });
  signIn(OWNER);
});
afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  localStorage.clear();
  signIn(null);
  vi.restoreAllMocks();
});

const enabledDevice = async () => {
  const app = installApp();
  await enableIosAppPush(app.bridge, OWNER, CONFIGURATION);
  registered.mockClear();
  return { app, device: readIosAppPushDevice()! };
};

describe("the iOS app's push", () => {
  it("is the app's alone: the web and the Android app have no bridge", () => {
    expect(iosAppBridge()).toBeNull();
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => false };
    expect(iosAppBridge()).toBeNull();
  });

  it("asks the player, then registers the phone's APNs token, in lowercase hex, for the signed-in account", async () => {
    const app = installApp();
    await enableIosAppPush(app.bridge, OWNER, CONFIGURATION);
    expect(app.calls).toEqual(["requestPermissions", "register"]);
    const device = readIosAppPushDevice()!;
    expect(device).toEqual({
      owner: OWNER,
      id: expect.stringMatching(UUID),
      token: expect.stringMatching(UUID),
      apnsToken: TOKEN.toLowerCase(),
      gameAlerts: true,
      directMessages: true,
    });
    expect(registered.mock.calls).toEqual([
      [
        {
          owner: OWNER,
          id: device.id,
          token: device.token,
          apnsToken: TOKEN.toLowerCase(),
          gameAlerts: true,
          directMessages: true,
        },
      ],
    ]);
    expect(alertsOn.mock.calls).toEqual([[OWNER, device.id]]);
    // The registration's listeners are gone once APNs answered.
    expect(app.listening("registration")).toBe(0);
  });

  it("registers nothing and keeps nothing when the player refuses, and Settings then says alerts are blocked", async () => {
    const app = installApp({ answer: "denied" });
    await expect(enableIosAppPush(app.bridge, OWNER, CONFIGURATION)).rejects.toThrow("permission_refused");
    expect(app.calls).toEqual(["requestPermissions"]);
    expect(registered).not.toHaveBeenCalled();
    expect(readIosAppPushDevice()).toBeNull();
    expect(await deviceSwitch()).toBe("blocked");
  });

  it("revokes a registration the identity service refused, so none is left behind", async () => {
    const app = installApp();
    registered.mockRejectedValueOnce(new Error("subscription_limit"));
    await expect(enableIosAppPush(app.bridge, OWNER, CONFIGURATION)).rejects.toThrow("subscription_limit");
    expect(revoked).toHaveBeenCalledOnce();
    expect(readIosAppPushDevice()).toBeNull();
  });

  it("at launch, registers the phone again under a new APNs token, after revoking the old registration", async () => {
    const { app, device } = await enabledDevice();
    await reconcileIosAppPush(app.bridge, OWNER);
    expect(registered).not.toHaveBeenCalled();

    app.state.token = NEW_TOKEN;
    await reconcileIosAppPush(app.bridge, OWNER);
    expect(revoked.mock.calls).toEqual([[device.id, device.token]]);
    const renewed = readIosAppPushDevice()!;
    expect(renewed).toMatchObject({ owner: OWNER, apnsToken: NEW_TOKEN.toLowerCase(), gameAlerts: true });
    expect(renewed.id).not.toBe(device.id);
    expect(registered.mock.calls).toEqual([
      [expect.objectContaining({ id: renewed.id, token: renewed.token, apnsToken: NEW_TOKEN.toLowerCase() })],
    ]);
  });

  it.each([
    ["signing out", null, "granted"],
    ["another account signing in", OTHER, "granted"],
    ["alerts turned off in iOS Settings", OWNER, "denied"],
  ])("revokes the registration on %s", async (_, owner, permission) => {
    const { app, device } = await enabledDevice();
    app.state.permission = permission;
    await reconcileIosAppPush(app.bridge, owner);
    expect(revoked.mock.calls).toEqual([[device.id, device.token]]);
    expect(readIosAppPushDevice()).toBeNull();
    expect(registered).not.toHaveBeenCalled();
  });

  it("keeps the registration while its revocation cannot reach the service, and revokes it at the next try", async () => {
    const { app, device } = await enabledDevice();
    revoked.mockRejectedValueOnce(new Error("offline"));
    await expect(reconcileIosAppPush(app.bridge, null)).rejects.toThrow("offline");
    expect(readIosAppPushDevice()).toEqual(device);
    await reconcileIosAppPush(app.bridge, null);
    expect(readIosAppPushDevice()).toBeNull();
  });

  it("turns off from Settings' switch, and on again", async () => {
    installApp();
    expect(await deviceSwitch()).toBe("off");
    expect(await deviceSwitch({ press: true })).toBe("on");
    expect(registered).toHaveBeenCalledOnce();
    expect(await deviceSwitch({ press: true })).toBe("off");
    expect(revoked).toHaveBeenCalledOnce();
    expect(readIosAppPushDevice()).toBeNull();
    await disableIosAppPush();
    expect(revoked).toHaveBeenCalledOnce();
  });
});

describe("a tapped alert", () => {
  const now = Date.now();
  const alert = (device: Pick<IosAppPushDevice, "owner" | "id">, kind: string, target: string, tag?: string) => ({
    aps: { alert: { title: "Realms", body: "Something happened" } },
    envelope: {
      version: 1,
      kind,
      subscriptionId: device.id,
      notification: {
        version: 1,
        id: `alert:${kind}`,
        owner: device.owner,
        title: "Realms",
        body: "Something happened",
        target,
        ...(tag ? { tag } : {}),
        createdAt: now,
        expiresAt: now + 120_000,
      },
    },
  });
  const device: IosAppPushDevice = {
    owner: OWNER,
    id: "8f9b3c2a-1d4e-4f6a-9b8c-7d6e5f4a3b2c",
    token: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    apnsToken: TOKEN.toLowerCase(),
    gameAlerts: true,
    directMessages: true,
  };
  const HOME = "https://play.realms.test/";
  const GAME = "https://play.realms.test/g/0xa1/1/map";

  it("opens the game it names, unless this page already shows that game", () => {
    expect(tappedAlertOpening(alert(device, "game", "/g/0xa1/1"), device, OWNER, HOME, now)).toEqual({
      page: "/g/0xa1/1",
    });
    expect(tappedAlertOpening(alert(device, "game", "/g/0xa1/1"), device, OWNER, GAME, now)).toBeNull();
  });

  it("opens chat on what it is about over the page it lands on, and a lobby's mention on the lobby's page", () => {
    expect(
      tappedAlertOpening(alert(device, "direct-message", "/chat", "direct-thread:0xa1|0xb2"), device, OWNER, GAME, now),
    ).toEqual({
      chat: { type: CHAT_ALERT_PRESSED, kind: "direct-message", target: "/chat", tag: "direct-thread:0xa1|0xb2" },
    });
    expect(tappedAlertOpening(alert(device, "mention", "/blitz/slot-noon"), device, OWNER, GAME, now)).toEqual({
      page: "/blitz/slot-noon",
    });
  });

  it("opens nothing for another account, an earlier registration, a signed-out page or an expired alert", () => {
    const game = alert(device, "game", "/g/0xa1/1");
    expect(tappedAlertOpening(alert({ ...device, owner: OTHER }, "game", "/g/0xa1/1"), device, OWNER, HOME, now)).toBe(
      null,
    );
    expect(tappedAlertOpening(game, { ...device, id: crypto.randomUUID() }, OWNER, HOME, now)).toBeNull();
    expect(tappedAlertOpening(game, device, null, HOME, now)).toBeNull();
    expect(tappedAlertOpening(game, null, OWNER, HOME, now)).toBeNull();
    expect(tappedAlertOpening(game, device, OWNER, HOME, now + 121_000)).toBeNull();
    expect(tappedAlertOpening({ aps: {} }, device, OWNER, HOME, now)).toBeNull();
  });

  it("from a cold start, reaches the chat drawn after it, and a game alert loads its page", async () => {
    const { app, device: enabled } = await enabledDevice();
    const opened = vi.spyOn(pageNavigation, "open").mockImplementation(() => {});
    const taps = listenForIosAppPushTaps(app.bridge);
    app.emit("pushNotificationActionPerformed", {
      notification: { data: alert(enabled, "direct-message", "/chat", "direct-thread:0xa1|0xb2") },
    });
    const pressed: ChatAlertPress[] = [];
    const unmount = await mountChat((press) => pressed.push(press));
    expect(pressed).toEqual([
      { type: CHAT_ALERT_PRESSED, kind: "direct-message", target: "/chat", tag: "direct-thread:0xa1|0xb2" },
    ]);
    app.emit("pushNotificationActionPerformed", { notification: { data: alert(enabled, "game", "/g/0xa1/1") } });
    expect(opened.mock.calls).toEqual([[`${location.origin}/g/0xa1/1`]]);
    await unmount();
    await taps.remove();
  });
});

/** Settings' switch for this device in the app: its state once read, after a press when asked. */
const deviceSwitch = async ({ press = false } = {}) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(identityClient, "getPushConfiguration").mockResolvedValue(CONFIGURATION);
  const Switch = () => {
    const device = useThisDevice(OWNER);
    return <button onClick={() => void device.toggle()}>{device.state}</button>;
  };
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<Switch />));
  if (press) await act(async () => container.querySelector("button")!.click());
  const state = container.textContent;
  await act(async () => root.unmount());
  return state;
};

const mountChat = async (onPress: (press: ChatAlertPress) => void) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const Chat = () => {
    useChatAlertPresses(onPress);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Chat />));
  return () => act(async () => root.unmount());
};
