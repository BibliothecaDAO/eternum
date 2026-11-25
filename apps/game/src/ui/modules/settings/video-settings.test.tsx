import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { pageNavigation } from "@/utils/page-navigation";
import { VideoSettings } from "./video-settings";

let host: HTMLDivElement;
let root: Root;
const page = window.location.href;

const render = async () => {
  root = createRoot(host);
  await act(async () => root.render(<VideoSettings />));
};

/** The device the page runs on: touch-first or not, and whether its browser can vibrate. */
const device = ({ touch, vibrate }: { touch: boolean; vibrate: boolean }) => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: touch && query === "(pointer: coarse)" }));
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate ? vi.fn(() => true) : undefined });
};

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  device({ touch: false, vibrate: true });
  host = document.createElement("div");
  document.body.append(host);
  await render();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const names = () => [...host.querySelectorAll(".ui-setting__name")].map((name) => name.textContent);
const reloadRow = () => names().includes("Applies after reload");
const toggle = (label: string) =>
  act(async () => host.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${label}"]`)!.click());
const choose = async (label: string, word: string) => {
  const setting = [...host.querySelectorAll(".ui-setting")].find(
    (row) => row.querySelector(".ui-setting__name")?.textContent === label,
  )!;
  const tab = [...setting.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((tab) => tab.textContent === word);
  await act(async () => tab!.click());
};
const remount = async () => {
  await act(async () => root.unmount());
  await render();
};

it("draws on a desktop no Renderer row and no Haptics, as nothing there vibrates", () => {
  expect(names()).toEqual(["Quality", "Shadows", "Reduced motion"]);
  expect(host.querySelector(".ui-setting__about")).toBeNull();
});

it("offers Haptics on a phone that can vibrate, and saves its choice; an iPhone, with no vibration, gets no row", async () => {
  device({ touch: true, vibrate: true });
  await remount();
  expect(names()).toEqual(["Quality", "Shadows", "Reduced motion", "Haptics"]);
  const haptics = () => host.querySelector('[role="switch"][aria-label="Haptics"]')!.getAttribute("aria-checked");
  const before = haptics();
  await toggle("Haptics");
  expect(haptics()).not.toBe(before);
  await toggle("Haptics");

  device({ touch: true, vibrate: false });
  await remount();
  expect(names()).not.toContain("Haptics");
});

it("offers Low, Balanced and High, saves a choice at once without leaving the page, and says it applies after a reload until undone", async () => {
  const setting = [...host.querySelectorAll(".ui-setting")].find(
    (row) => row.querySelector(".ui-setting__name")?.textContent === "Quality",
  )!;
  expect([...setting.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual([
    "Low",
    "Balanced",
    "High",
  ]);
  await choose("Quality", "Low");
  expect(JSON.parse(localStorage.getItem("eternum-graphics")!)).toEqual({ quality: "low", shadows: true });
  expect(window.location.href).toBe(page);
  expect(reloadRow()).toBe(true);
  await choose("Quality", "High");
  expect(reloadRow()).toBe(false);
});

it("saves Shadows at once beside Quality, says it applies after a reload, and stops saying so when undone", async () => {
  await toggle("Shadows");
  expect(JSON.parse(localStorage.getItem("eternum-graphics")!)).toEqual({ quality: "high", shadows: false });
  expect(reloadRow()).toBe(true);
  await toggle("Shadows");
  expect(reloadRow()).toBe(false);
});

it("applies Reduced motion at once, with nothing to reload", async () => {
  const motion = () => host.querySelector('[role="switch"][aria-label="Reduced motion"]')!.getAttribute("aria-checked");
  const before = motion();
  await toggle("Reduced motion");
  expect(motion()).not.toBe(before);
  expect(reloadRow()).toBe(false);
  await toggle("Reduced motion");
});

it("reloads the page as it is, a recovery's renderer in its address kept", async () => {
  window.history.replaceState(null, "", "/g/0x1/6/map?spectate=true&rendererMode=webgpu-force-webgl#world");
  await choose("Quality", "Low");
  const open = vi.spyOn(pageNavigation, "open").mockImplementation(() => {});
  const reload = vi.spyOn(pageNavigation, "reload").mockImplementation(() => {});
  await act(async () =>
    [...host.querySelectorAll("button")].find((button) => button.textContent === "Reload")!.click(),
  );
  expect([open.mock.calls.length, reload.mock.calls.length]).toEqual([0, 1]);
  open.mockRestore();
  reload.mockRestore();
  window.history.replaceState(null, "", page);
});
