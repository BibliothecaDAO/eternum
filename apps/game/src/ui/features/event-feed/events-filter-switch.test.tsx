// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { resolveSpectateIntent } from "@/utils/spectator-session";

const words = (host: HTMLElement) => [...host.querySelectorAll("button")].map((button) => button.textContent);
const pressed = (host: HTMLElement) =>
  [...host.querySelectorAll("button")]
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.textContent);
const press = (host: HTMLElement, word: string) =>
  act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === word)!.click());

/** The switch as a page loads it, the saved choices read from this device's storage as it stands, and its sign-in. */
const loadSwitch = async () => {
  vi.resetModules();
  const { useAccountStore } = await import("@/hooks/store/use-account-store");
  const signIn = (address: string) => act(() => useAccountStore.setState({ account: { address } as never }));
  return { EventsFilterSwitch: (await import("./events-filter-switch")).EventsFilterSwitch, signIn };
};

afterEach(() => localStorage.clear());

it("offers Important and All, starts on Important, keeps each player's choice, and shows one choice in Events and the Log", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { EventsFilterSwitch, signIn } = await loadSwitch();
  const [card, log] = [document.createElement("div"), document.createElement("div")];
  const roots = [createRoot(card), createRoot(log)];
  signIn("0x0a1");
  act(() => roots.forEach((root) => root.render(<EventsFilterSwitch />)));
  try {
    expect(words(card)).toEqual(["Important", "All"]);
    expect(pressed(card)).toEqual(["Important"]);
    press(card, "All");
    expect([pressed(card), pressed(log)]).toEqual([["All"], ["All"]]);

    signIn("0xb2");
    expect(pressed(log)).toEqual(["Important"]);
    signIn("0xa1");
    expect(pressed(log)).toEqual(["All"]);
    expect(localStorage.getItem("eternum-events-filter")).toContain('"0xa1":"all"');
  } finally {
    act(() => roots.forEach((root) => root.unmount()));
  }
});

it("opens a player who had chosen Mine on All, which holds everything Mine showed", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.setItem(
    "eternum-events-filter",
    JSON.stringify({ state: { byPlayer: { "0xa1": "mine", "0xb2": "important" } }, version: 0 }),
  );
  const { EventsFilterSwitch, signIn } = await loadSwitch();
  const host = document.createElement("div");
  const root = createRoot(host);
  signIn("0xa1");
  act(() => root.render(<EventsFilterSwitch />));
  try {
    expect(pressed(host)).toEqual(["All"]);
    signIn("0xb2");
    expect(pressed(host)).toEqual(["Important"]);
  } finally {
    act(() => root.unmount());
  }
});

it("offers a viewer who entered to spectate the same two lenses", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { EventsFilterSwitch } = await loadSwitch();
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => resolveSpectateIntent({ search: "?spectate=true" }));
  act(() => root.render(<EventsFilterSwitch />));
  try {
    expect(words(host)).toEqual(["Important", "All"]);
  } finally {
    resolveSpectateIntent({ search: "" });
    act(() => root.unmount());
  }
});
