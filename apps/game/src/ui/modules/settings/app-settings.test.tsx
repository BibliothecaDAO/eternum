import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useInstallState } from "@/pwa/install-state";

import { AppSettings } from "./app-settings";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  useInstallState.setState({ installed: false });
});

/** The App section a player sees on this device, with the app installed or not: its name and its rows' names. */
const appSection = async ({ touch, installed }: { touch: boolean; installed: boolean }) => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: touch && query === "(pointer: coarse)" }));
  useInstallState.setState({ installed });
  await act(async () => root.render(<AppSettings onShowKeys={() => undefined} />));
  return [...host.querySelectorAll("h2, .ui-setting__name")].map((element) => element.textContent);
};

it("offers on a desktop Install and the keys, and the keys alone once the app is installed", async () => {
  expect(await appSection({ touch: false, installed: false })).toEqual(["App", "Install", "Keyboard shortcuts"]);
  expect(await appSection({ touch: false, installed: true })).toEqual(["App", "Keyboard shortcuts"]);
});

it("offers on a phone no keys, and no App section at all once the app is installed", async () => {
  expect(await appSection({ touch: true, installed: false })).toEqual(["App", "Install"]);
  expect(await appSection({ touch: true, installed: true })).toEqual([]);
});
