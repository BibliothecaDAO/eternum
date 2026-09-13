import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  device: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  test: vi.fn(),
  status: vi.fn(),
}));
vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: { getPushConfiguration: mocks.config, getPushSubscriptionStatus: mocks.status },
}));
vi.mock("@/pwa/push-notification-client", () => ({
  readPushDevice: mocks.device,
  enablePushNotifications: mocks.enable,
  disablePushNotifications: mocks.disable,
  sendBackgroundPushTest: mocks.test,
}));
vi.mock("@/pwa/local-notification-client", () => ({ localNotificationCapability: () => null }));
vi.mock("@/runtime/world", () => ({ getActiveWorld: () => ({ chain: "madara", name: "game" }) }));
vi.mock("@/play/navigation/play-route", () => ({ buildEntryHref: () => "/enter/madara/game" }));
import { PushNotificationSettings } from "./push-notification-settings";
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.config.mockResolvedValue({ enabled: true, publicKey: "key" });
  mocks.device.mockResolvedValue(null);
  mocks.status.mockResolvedValue({ registered: true });
  vi.stubGlobal("navigator", { locks: {}, serviceWorker: { getRegistration: async () => ({ active: {} }) } });
  vi.stubGlobal("PushManager", class {});
});
afterEach(() => vi.unstubAllGlobals());
async function mount(owner: string | null = "0x1") {
  const container = document.createElement("div"),
    root = createRoot(container);
  await act(async () => root.render(<PushNotificationSettings owner={owner} />));
  return {
    container,
    click: (text: string) =>
      act(async () => {
        [...container.querySelectorAll("button")].find((b) => b.textContent === text)!.click();
      }),
    close: () => act(async () => root.unmount()),
  };
}
it("labels the test-only milestone and enables on an explicit click", async () => {
  const ui = await mount();
  try {
    expect(ui.container.textContent).toContain("Automatic game alerts still require an open page");
    expect(mocks.enable).not.toHaveBeenCalled();
    await ui.click("Enable background tests");
    expect(mocks.enable).toHaveBeenCalledWith("0x1", "key");
  } finally {
    await ui.close();
  }
});
it("keeps an existing device removable when server sending is disabled", async () => {
  mocks.config.mockResolvedValue({ enabled: false });
  mocks.device.mockResolvedValue({ owner: "0x1", id: "id", state: "active" });
  const ui = await mount();
  try {
    await ui.click("Disable background tests");
    expect(mocks.disable).toHaveBeenCalledWith("0x1");
  } finally {
    await ui.close();
  }
});
it("shows expired registration errors without hiding the cleanup action", async () => {
  mocks.device.mockResolvedValue({ owner: "0x1", id: "id", state: "active" });
  mocks.status.mockResolvedValue({ registered: false });
  const ui = await mount();
  try {
    expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("expired");
    expect(ui.container.textContent).toContain("Disable background tests");
  } finally {
    await ui.close();
  }
});

it("keeps local removal available when configuration cannot load offline", async () => {
  mocks.device.mockResolvedValue({ owner: "0x1", id: "id", state: "active" });
  mocks.config.mockRejectedValueOnce(new Error("Offline"));
  const ui = await mount();
  try {
    expect(ui.container.querySelector('[role="alert"]')?.textContent).toBe("Offline");
    await ui.click("Disable background tests");
    expect(mocks.disable).toHaveBeenCalledWith("0x1");
  } finally {
    await ui.close();
  }
});

it("does not let a stale focus refresh restore the device after disablement", async () => {
  mocks.device.mockResolvedValue({ owner: "0x1", id: "id", state: "active" });
  const ui = await mount();
  let finish!: (value: unknown) => void;
  mocks.config.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  try {
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    mocks.device.mockResolvedValue(null);
    await ui.click("Disable background tests");
    await act(async () => {
      finish({ enabled: true, publicKey: "key" });
    });
    expect(ui.container.textContent).toContain("Enable background tests");
    expect(ui.container.textContent).not.toContain("Send background test");
  } finally {
    await ui.close();
  }
});
