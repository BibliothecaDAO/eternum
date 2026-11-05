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
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
  vi.useRealTimers();
});

/** What the popup shows: its title, its lines and its buttons; null while it is closed. */
const read = () => {
  // The kit's modal layer draws it at the body's end.
  const card = document.body.querySelector("[role='dialog']");
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
/** The same page drawn again, its map clear or not (no remount). */
const draw = async (clear: boolean) => {
  await act(async () => root.render(<AlertsPopup clear={clear} />));
  return read();
};
const button = (label: string) =>
  [...document.body.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
const press = async (label: string) => {
  await act(async () => button(label)!.click());
};
/** Another tab of the game on this device writes the popup's memory; `announce`: the browser tells this tab. */
const otherTabWrites = async (memory: { notNows: number; shownAt: number | null }, announce = true) => {
  const value = JSON.stringify({ state: memory, version: 1 });
  window.localStorage.setItem("realms-alerts-ask", value);
  if (announce)
    await act(async () =>
      window.dispatchEvent(new StorageEvent("storage", { key: "realms-alerts-ask", newValue: value })),
    );
};
const key = async (name: string, shiftKey = false) => {
  await act(async () => {
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: name, shiftKey, bubbles: true }));
  });
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

it("asks no second time in the week when another open tab showed it, told by the browser or not", async () => {
  // This tab is open on a map that is not clear yet; another tab shows the popup.
  expect(await draw(false)).toBeNull();
  await otherTabWrites({ notNows: 0, shownAt: START });
  expect(await draw(true)).toBeNull();
  // A write this tab was never told of is read as the popup decides.
  await act(async () => root.unmount());
  root = createRoot(container);
  useAskMemory.setState({ notNows: 0, shownAt: null });
  await otherTabWrites({ notNows: 0, shownAt: START }, false);
  expect(await draw(true)).toBeNull();
});

it("ends in every open tab after the third Not now in any of them, and counts on from another tab's Not nows", async () => {
  expect(await draw(false)).toBeNull();
  await otherTabWrites({ notNows: 3, shownAt: START - 30 * DAY });
  expect(await draw(true)).toBeNull();
  // Two Not nows from another tab, not announced: this tab's Not now is the third.
  await act(async () => root.unmount());
  root = createRoot(container);
  useAskMemory.setState({ notNows: 0, shownAt: null });
  await otherTabWrites({ notNows: 2, shownAt: START - 30 * DAY }, false);
  expect(await draw(true)).not.toBeNull();
  await press("Not now");
  expect(useAskMemory.getState().notNows).toBe(3);
  expect(JSON.parse(window.localStorage.getItem("realms-alerts-ask")!).state.notNows).toBe(3);
});

it("gives the screen back when the map stops being clear, counting the showing and no Not now", async () => {
  expect(await draw(true)).not.toBeNull();
  // A day's end takes the screen, or the player leaves their own map.
  expect(await draw(false)).toBeNull();
  // Clear again the same week: it was shown, so it does not come back.
  expect(await draw(true)).toBeNull();
  expect(useAskMemory.getState()).toMatchObject({ shownAt: START, notNows: 0 });
});

it("holds the keyboard: focus moves into it, Tab goes round its two buttons, the HUD behind is inert, and focus returns", async () => {
  const hud = document.createElement("button");
  hud.textContent = "Season";
  document.body.append(hud);
  hud.focus();
  try {
    await draw(true);
    const dialog = document.body.querySelector("[role='dialog']")!;
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(hud.closest("[inert]")).not.toBeNull();
    button("Turn on alerts")!.focus();
    await key("Tab");
    expect(document.activeElement).toBe(button("Not now"));
    await key("Tab", true);
    expect(document.activeElement).toBe(button("Turn on alerts"));
    await press("Not now");
    expect(read()).toBeNull();
    expect(hud.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(hud);
  } finally {
    hud.remove();
  }
});

it("takes Escape as Not now: it closes and counts", async () => {
  await draw(true);
  await key("Escape");
  expect(read()).toBeNull();
  expect(useAskMemory.getState().notNows).toBe(1);
});
