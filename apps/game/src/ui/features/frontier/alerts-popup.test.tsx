import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const device = vi.hoisted(() => ({ state: "off" as "off" | "on" | "install" | "blocked", toggle: vi.fn() }));
const account = vi.hoisted(() => ({ level: "off", save: vi.fn(), install: vi.fn() }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ status: "signed-in", session: { user: { realmsId: "0x7" } } }),
  notificationOwnerOf: () => "0x7",
}));
vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferences: () => ({
    status: "ready",
    saved: { level: account.level, revision: 1 },
    save: account.save,
  }),
}));
vi.mock("@/shell/profile/this-device", () => ({ useThisDevice: () => device }));
vi.mock("@/pwa/install-state", () => ({ useInstall: () => ({ install: account.install }) }));

import { useAskMemory } from "@/shell/profile/alerts-ask";
import { AlertsPopup } from "./alerts-popup";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse("2026-11-05T09:00:00Z");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
  useAskMemory.setState({ notNows: 0, shownAt: null });
  device.state = "off";
  account.level = "off";
  device.toggle.mockClear();
  account.save.mockClear();
  account.install.mockClear();
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
});

/** What the popup shows: its title, its lines and its buttons; null while it is closed. */
const read = () => {
  const card = container.querySelector("[role='dialog']");
  return (
    card && {
      title: card.getAttribute("aria-label"),
      lines: [...card.querySelectorAll(".ui-confirm__body > span")].map((line) => line.textContent),
      buttons: [...card.querySelectorAll("button")].map((button) => button.textContent),
    }
  );
};
/** The game opened on the player's map: clear once no day's end is owed. */
const open = async (clear = true) => {
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(<AlertsPopup clear={clear} />));
  return read();
};
const press = async (label: string) => {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
  await act(async () => button!.click());
};
const later = (days: number) => vi.setSystemTime(START + days * DAY);

it("opens once the map is clear, saying what the Important level pushes, with Not now and Turn on alerts", async () => {
  expect(await open(false)).toBeNull();
  expect(await open()).toEqual({
    title: "Know when to come back",
    lines: ["Know when to come back", "A push for each day's opening, rested armies, fights, results and messages."],
    buttons: ["Not now", "Turn on alerts"],
  });
  expect(useAskMemory.getState().shownAt).toBe(START);
});

it("shows at most once a week: not again within 7 days of showing, even unanswered, and again after", async () => {
  expect(await open()).not.toBeNull();
  // Left unanswered and the game opened again: shown once is shown for the week.
  expect(await open()).toBeNull();
  later(6.9);
  expect(await open()).toBeNull();
  later(7);
  expect(await open()).not.toBeNull();
  expect(useAskMemory.getState().shownAt).toBe(START + 7 * DAY);
});

it("closes on Not now, and three Not nows end it", async () => {
  for (const week of [0, 1, 2]) {
    later(week * 7);
    expect(await open()).not.toBeNull();
    await press("Not now");
    expect(read()).toBeNull();
  }
  expect(useAskMemory.getState().notNows).toBe(3);
  later(30);
  expect(await open()).toBeNull();
});

it("turns this device on and lifts an Off level to Important in the tap, and closes", async () => {
  await open();
  await press("Turn on alerts");
  expect(device.toggle).toHaveBeenCalledOnce();
  expect(account.save).toHaveBeenCalledWith("important");
  expect(read()).toBeNull();
});

it("tells an iPhone's browser to install first, and its button installs", async () => {
  device.state = "install";
  expect(await open()).toEqual({
    title: "Know when to come back",
    lines: [
      "Know when to come back",
      "A push for each day's opening, rested armies, fights, results and messages.",
      "On an iPhone, alerts need Realms on your Home Screen first.",
    ],
    buttons: ["Not now", "Add to Home Screen"],
  });
  await press("Add to Home Screen");
  expect(account.install).toHaveBeenCalledOnce();
  expect(device.toggle).not.toHaveBeenCalled();
});

it("asks nothing of a device that gets the push already, or that blocked alerts, and spends nothing", async () => {
  device.state = "on";
  account.level = "important";
  expect(await open()).toBeNull();
  device.state = "blocked";
  expect(await open()).toBeNull();
  expect(useAskMemory.getState().shownAt).toBeNull();
});

it("keeps the Not nows of the day asks it replaced", async () => {
  window.localStorage.setItem(
    "realms-alerts-ask",
    JSON.stringify({ state: { notNows: 2, asked: { "0xa:1": { day: 12, host: null } } }, version: 0 }),
  );
  await act(async () => useAskMemory.persist.rehydrate());
  expect(useAskMemory.getState()).toMatchObject({ notNows: 2, shownAt: null });
});
