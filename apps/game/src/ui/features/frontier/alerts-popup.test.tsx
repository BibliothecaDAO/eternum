import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const device = vi.hoisted(() => ({ state: "off" as "off" | "on" | "install" | "blocked", toggle: vi.fn() }));
const account = vi.hoisted(() => ({ level: "off", save: vi.fn(), install: vi.fn() }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ status: "signed-in", session: { user: { realmsId: "0x7" } } }),
  notificationOwnerOf: () => "0x7",
  identityClient: { addOpeningProgress: (additions: { seen?: string[] }) => service.add(additions) },
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

import { accountAnswers, leaveThePage } from "@/shell/standing-prompts-fixture";
import { AlertsPopup } from "./alerts-popup";
import { ADD_TO_HOME_SCREEN, ALERTS_POPUP } from "@/ui/design-system/kit/words";

let service = accountAnswers();

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  service = accountAnswers();
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
  await leaveThePage("another");
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
const draw = async (clear: boolean) => {
  await act(async () => root.render(<AlertsPopup clear={clear} />));
  await act(async () => {});
  return read();
};
const open = async (clear = true, device: "same" | "another" = "same") => {
  await act(async () => root.unmount());
  await leaveThePage(device);
  root = createRoot(container);
  return draw(clear);
};
const button = (label: string) =>
  [...document.body.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
const press = async (label: string) => {
  await act(async () => button(label)!.click());
};
const key = async (name: string, shiftKey = false) => {
  await act(async () => {
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: name, shiftKey, bubbles: true }));
  });
};

it("opens once the map is clear, saying what the Important level pushes, with Not now and Turn on alerts", async () => {
  expect(await open(false)).toBeNull();
  expect(await open()).toEqual({
    title: "Know when to come back",
    lines: [
      "Know when to come back",
      "A push for each day's opening, Deep sites you can take, rested armies, fights, results and messages.",
    ],
    buttons: ["Not now", "Turn on alerts"],
  });
  expect([...service.seen]).toEqual(["alerts-popup"]);
});

it("asks an account once: after Not now it stays closed on this device and on another", async () => {
  expect(await open()).not.toBeNull();
  await press("Not now");
  expect(read()).toBeNull();
  expect(await open()).toBeNull();
  expect(await open(true, "another")).toBeNull();
});

it("does not come back when the game is opened again with the popup left unanswered", async () => {
  expect(await open()).not.toBeNull();
  expect(await open()).toBeNull();
  expect(await open(true, "another")).toBeNull();
});

it("stays closed on a device that cannot read what the account answered", async () => {
  service.down = true;
  expect(await open()).toBeNull();
});

it("turns this device on and lifts an Off level to Important in the tap, and closes", async () => {
  await open();
  await press(ALERTS_POPUP.turnOn);
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
      "A push for each day's opening, Deep sites you can take, rested armies, fights, results and messages.",
      "On an iPhone, alerts need Realms on your Home Screen first.",
    ],
    buttons: ["Not now", "Add to Home Screen"],
  });
  await press(ADD_TO_HOME_SCREEN);
  expect(account.install).toHaveBeenCalledOnce();
  expect(device.toggle).not.toHaveBeenCalled();
});

it("asks nothing of a device that gets the push already, or that blocked alerts, and spends nothing", async () => {
  device.state = "on";
  account.level = "important";
  expect(await open()).toBeNull();
  device.state = "blocked";
  expect(await open()).toBeNull();
  expect(service.seen.size).toBe(0);
});

it("gives the screen back when the map stops being clear, and does not come back", async () => {
  expect(await draw(true)).not.toBeNull();
  // A day's end takes the screen, or the player leaves their own map.
  expect(await draw(false)).toBeNull();
  expect(await draw(true)).toBeNull();
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
    button(ALERTS_POPUP.turnOn)!.focus();
    await key("Tab");
    expect(document.activeElement).toBe(button("Not now"));
    await key("Tab", true);
    expect(document.activeElement).toBe(button(ALERTS_POPUP.turnOn));
    await press("Not now");
    expect(read()).toBeNull();
    expect(hud.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(hud);
  } finally {
    hud.remove();
  }
});

it("takes Escape as Not now: it closes", async () => {
  await draw(true);
  await key("Escape");
  expect(read()).toBeNull();
  expect(await open()).toBeNull();
});
