import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  getNotificationPreferences: vi.fn(),
  saveNotificationPreferences: vi.fn(),
}));
const device = vi.hoisted(() => ({ state: "unavailable", failed: false, toggle: vi.fn() }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ status: "signed-in", session: { user: { realmsId: "0x7" } } }),
  notificationOwnerOf: () => "0x7",
  identityClient: client,
}));
vi.mock("@/shell/profile/this-device", () => ({ useThisDevice: () => device }));

import { useNotificationPreferenceStore } from "@/hooks/use-notification-preferences";

import { NotificationSettings } from "./notification-settings";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useNotificationPreferenceStore.setState({ owner: undefined, status: "loading", saved: null, error: null });
  client.getNotificationPreferences.mockReset();
  client.saveNotificationPreferences.mockReset();
  Object.assign(device, { state: "unavailable", failed: false });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const select = () => host.querySelector<HTMLButtonElement>(".ui-select")!;
const tryAgain = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Try again");
const failures = () => [...host.querySelectorAll('[role="alert"]')].map((notice) => notice.textContent);
const choose = async (word: string) => {
  await act(async () => select().click());
  const item = [...document.querySelectorAll<HTMLButtonElement>(".ui-select__layer .ui-menu__item")].find(
    (option) => option.textContent === word,
  );
  await act(async () => item!.click());
};

it("offers Try again on a failed read, recovers to the saved level on it, then saves the next level chosen", async () => {
  client.getNotificationPreferences
    .mockRejectedValueOnce(new Error("temporary failure"))
    .mockResolvedValueOnce({ owner: "0x7", level: "important", revision: 3 });
  client.saveNotificationPreferences.mockResolvedValueOnce({ owner: "0x7", level: "all", revision: 4 });
  await act(async () => root.render(<NotificationSettings />));

  expect(failures()).toEqual(["Notifications did not answer.Try again"]);
  expect(select().disabled).toBe(true);

  await act(async () => tryAgain()!.click());
  expect(client.getNotificationPreferences).toHaveBeenCalledTimes(2);
  expect(failures()).toEqual([]);
  expect(select().disabled).toBe(false);
  expect(select().textContent).toBe("Important");

  await choose("All");
  expect(client.saveNotificationPreferences).toHaveBeenCalledWith({ owner: "0x7", level: "all", revision: 3 });
  expect(select().textContent).toBe("All");
});

it("offers Try again on a failed save, and reads the saved level back on it", async () => {
  client.getNotificationPreferences
    .mockResolvedValueOnce({ owner: "0x7", level: "off", revision: 1 })
    .mockResolvedValueOnce({ owner: "0x7", level: "off", revision: 1 });
  client.saveNotificationPreferences.mockRejectedValueOnce(new Error("temporary failure"));
  await act(async () => root.render(<NotificationSettings />));

  await choose("All");
  expect(failures()).toEqual(["Notifications did not answer.Try again"]);

  await act(async () => tryAgain()!.click());
  expect(failures()).toEqual([]);
  expect(select().textContent).toBe("Off");
});

it("names a device failure without Try again: the levels still read and save", async () => {
  client.getNotificationPreferences.mockResolvedValueOnce({ owner: "0x7", level: "off", revision: 1 });
  device.failed = true;
  await act(async () => root.render(<NotificationSettings />));

  expect(failures()).toEqual(["Notifications did not answer."]);
  expect(tryAgain()).toBeUndefined();
  expect(select().disabled).toBe(false);
});
