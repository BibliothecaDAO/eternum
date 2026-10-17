// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { EventsFilterSwitch } from "./events-filter-switch";

const signIn = (address: string) => act(() => useAccountStore.setState({ account: { address } as never }));
const pressed = (host: HTMLElement) =>
  [...host.querySelectorAll("button")]
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.textContent);
const press = (host: HTMLElement, word: string) =>
  act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === word)!.click());

afterEach(() => localStorage.clear());

it("starts on Important, keeps each player's choice, and shows one choice in every switch (Events and the Log)", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const [card, log] = [document.createElement("div"), document.createElement("div")];
  const roots = [createRoot(card), createRoot(log)];
  signIn("0x0a1");
  act(() => roots.forEach((root) => root.render(<EventsFilterSwitch />)));
  try {
    expect(pressed(card)).toEqual(["Important"]);
    press(card, "Mine");
    expect([pressed(card), pressed(log)]).toEqual([["Mine"], ["Mine"]]);

    signIn("0xb2");
    expect(pressed(log)).toEqual(["Important"]);
    signIn("0xa1");
    expect(pressed(log)).toEqual(["Mine"]);
    expect(localStorage.getItem("eternum-events-filter")).toContain('"0xa1":"mine"');
  } finally {
    act(() => roots.forEach((root) => root.unmount()));
  }
});
