import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: "0x1",
  capability: null as string | null,
  device: vi.fn(),
  request: vi.fn(),
  permission: vi.fn(),
  trace: [] as string[],
}));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySessionStore: { getState: () => ({ session: { user: { id: mocks.owner } } }) },
}));
vi.mock("@/runtime/world", () => ({ getActiveWorld: () => ({ chain: "madara", name: "game-1" }) }));
vi.mock("@/play/navigation/play-route", () => ({ buildEntryHref: () => "/enter/madara/game-1" }));
vi.mock("@/pwa/local-notification-client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  localNotificationCapability: () => mocks.capability,
  readLocalNotificationDevice: mocks.device,
  notificationWorkerRequest: mocks.request,
}));
import { useNotificationDeliveryError } from "@/pwa/local-notification-client";
import { NotificationDeviceSettings } from "./notification-device-settings";
const enabled = { owner: "0x1", token: "token", enabledAt: 1 };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.owner = "0x1";
  mocks.capability = null;
  mocks.trace = [];
  mocks.device.mockResolvedValue(null);
  mocks.request.mockImplementation(async () => {
    mocks.trace.push("worker");
    return enabled;
  });
  mocks.permission.mockImplementation(async () => {
    mocks.trace.push("permission");
    return "granted";
  });
  useNotificationDeliveryError.setState({ error: null });
  vi.stubGlobal("Notification", { permission: "default", requestPermission: mocks.permission });
});
afterEach(() => vi.unstubAllGlobals());
async function mount(owner: string | null = "0x1") {
  const container = document.createElement("div"),
    root = createRoot(container);
  await act(async () => root.render(<NotificationDeviceSettings owner={owner} preferenceReady />));
  return {
    container,
    click: async (text: string) =>
      act(async () => {
        [...container.querySelectorAll("button")].find((button) => button.textContent === text)!.click();
      }),
    close: () => act(async () => root.unmount()),
  };
}
it("requests permission in the enabling gesture before worker IO and wires test delivery", async () => {
  const ui = await mount();
  try {
    await ui.click("Enable device notifications");
    expect(mocks.trace).toEqual(["permission", "worker"]);
    expect(mocks.request).toHaveBeenCalledWith("0x1", "enable");
    mocks.device.mockResolvedValue(enabled);
    mocks.request.mockResolvedValue("shown");
    await ui.click("Send test notification");
    expect(mocks.request).toHaveBeenLastCalledWith(
      "0x1",
      "test",
      expect.objectContaining({
        token: "token",
        payload: expect.objectContaining({ target: "/enter/madara/game-1", owner: "0x1" }),
      }),
    );
    expect(ui.container.textContent).toContain("Test sent");
  } finally {
    await ui.close();
  }
});
it("does not enable after denied permission", async () => {
  mocks.permission.mockResolvedValue("denied");
  const ui = await mount();
  try {
    await ui.click("Enable device notifications");
    expect(mocks.request).not.toHaveBeenCalled();
    expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("not granted");
  } finally {
    await ui.close();
  }
});
it("does not retarget permission approval after an account switch", async () => {
  mocks.permission.mockImplementation(async () => {
    mocks.owner = "0x2";
    return "granted";
  });
  const ui = await mount();
  try {
    await ui.click("Enable device notifications");
    expect(mocks.request).not.toHaveBeenCalled();
    expect(ui.container.textContent).toContain("account changed");
  } finally {
    await ui.close();
  }
});
it("does not ask for permission on unsupported or anonymous surfaces", async () => {
  mocks.capability = "Install on your Home Screen";
  const ui = await mount();
  try {
    expect(ui.container.querySelector("button")?.disabled).toBe(true);
    expect(ui.container.textContent).toContain("Home Screen");
    expect(mocks.permission).not.toHaveBeenCalled();
  } finally {
    await ui.close();
  }
  const anonymous = await mount(null);
  try {
    expect(anonymous.container.querySelector("button")).toBeNull();
    expect(anonymous.container.textContent).toContain("Sign in");
  } finally {
    await anonymous.close();
  }
});

it("shows unknown status after a worker read failure and recovers after explicit enablement", async () => {
  vi.stubGlobal("navigator", { serviceWorker: {} });
  mocks.device.mockRejectedValue(new Error("Worker unavailable"));
  const ui = await mount();
  try {
    expect(ui.container.textContent).toContain("Device delivery: Unknown");
    expect(ui.container.textContent).toContain("Worker unavailable");
    await ui.click("Enable device notifications");
    expect(ui.container.textContent).toContain("Device delivery: Local");
    expect(ui.container.textContent).not.toContain("Worker unavailable");
  } finally {
    await ui.close();
  }
});
