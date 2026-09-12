import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: "0x1" as string | null,
  status: "signed-in",
  spectating: false,
  get: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ status: mocks.status, session: mocks.owner ? { user: { id: mocks.owner } } : null }),
  identityClient: { getNotificationPreferences: mocks.get, saveNotificationPreferences: mocks.save },
}));
vi.mock("@/utils/spectator-session", () => ({ isExplicitSpectateSession: () => mocks.spectating }));
import { NotificationSettings } from "./notification-settings";

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  mocks.owner = "0x1";
  mocks.status = "signed-in";
  mocks.spectating = false;
  mocks.get.mockReset().mockResolvedValue({ owner: "0x1", level: "important", revision: 2 });
  mocks.save.mockReset();
});

async function mount() {
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = () =>
    act(async () => {
      root.render(<NotificationSettings />);
    });
  await render();
  const click = (label: string) =>
    act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === label)!.click();
    });
  return { container, render, click, close: () => act(async () => root.unmount()) };
}

it("keeps the acknowledged level while saving and surfaces conflicts without claiming success", async () => {
  let reject!: (error: Error) => void;
  mocks.save.mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  const ui = await mount();
  try {
    await ui.click("All");
    expect(mocks.save).toHaveBeenCalledWith({ owner: "0x1", level: "all", revision: 2 });
    expect(ui.container.textContent).toContain("Saving…");
    expect(ui.container.querySelector('[aria-pressed="true"]')?.textContent).toBe("Important");
    await act(async () => reject(new Error("Preferences changed on another device.")));
    expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain("another device");
    expect(ui.container.textContent).not.toContain("Synced with your account.");
    mocks.get.mockResolvedValue({ owner: "0x1", level: "standard", revision: 3 });
    await ui.click("Reload preferences");
    expect(ui.container.querySelector('[aria-pressed="true"]')?.textContent).toBe("Standard");
    mocks.save.mockResolvedValue({ owner: "0x1", level: "off", revision: 4 });
    await ui.click("Off");
    expect(mocks.save).toHaveBeenLastCalledWith({ owner: "0x1", level: "off", revision: 3 });
    expect(ui.container.textContent).toContain("Synced with your account.");
    expect(ui.container.textContent).toContain("Device delivery: Off");
  } finally {
    await ui.close();
  }
});

it("keeps anonymous choices local and loads account preferences without uploading defaults", async () => {
  mocks.owner = null;
  mocks.status = "anonymous";
  const ui = await mount();
  try {
    await ui.click("All");
    expect(localStorage.getItem("eternum:anonymous-notification-level:v1")).toBe("all");
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.owner = "0x1";
    mocks.status = "signed-in";
    await ui.render();
    expect(ui.container.querySelector('[aria-pressed="true"]')?.textContent).toBe("Important");
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.owner = null;
    mocks.status = "anonymous";
    await ui.render();
    expect(ui.container.querySelector('[aria-pressed="true"]')?.textContent).toBe("All");
  } finally {
    await ui.close();
  }
});

it("discards stale account responses and refreshes on focus and reconnect", async () => {
  let finish!: (value: unknown) => void;
  mocks.get.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const ui = await mount();
  try {
    mocks.owner = "0x2";
    mocks.get.mockResolvedValue({ owner: "0x2", level: "off", revision: 0 });
    await ui.render();
    await act(async () => finish({ owner: "0x1", level: "all", revision: 10 }));
    expect(ui.container.querySelector('[aria-pressed="true"]')?.textContent).toBe("Off");
    mocks.get.mockResolvedValue({ owner: "0x2", level: "standard", revision: 1 });
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(ui.container.querySelector('[aria-pressed="true"]')?.textContent).toBe("Standard");
    mocks.get.mockRejectedValue(new Error("Offline"));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(ui.container.querySelector('[role="alert"]')?.textContent).toBe("Offline");
  } finally {
    await ui.close();
  }
});

it("suppresses settings and permission prompts for spectators", async () => {
  mocks.spectating = true;
  const ui = await mount();
  try {
    expect(ui.container.textContent).toContain("off while spectating");
    expect(ui.container.querySelector("button")).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  } finally {
    await ui.close();
  }
});
