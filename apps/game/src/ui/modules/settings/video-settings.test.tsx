import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

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
const reloadRow = () => names().includes("Applies after a reload");
const toggle = (label: string) =>
  act(async () => host.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${label}"]`)!.click());
const choose = async (label: string, word: string) => {
  await act(async () => host.querySelector<HTMLButtonElement>(`.ui-select[aria-label="${label}"]`)!.click());
  const item = [...document.querySelectorAll<HTMLButtonElement>(".ui-select__layer .ui-menu__item")].find(
    (option) => option.textContent === word,
  );
  await act(async () => item!.click());
};
const remount = async () => {
  await act(async () => root.unmount());
  await render();
};

it("draws on a desktop no Renderer row and no Haptics, as nothing there vibrates", () => {
  expect(names()).toEqual(["Quality", "Frame rate", "Shadows", "Reduced motion"]);
  expect(host.querySelector(".ui-setting__about")).toBeNull();
});

it("offers Haptics on a phone that can vibrate, and saves its choice; an iPhone, with no vibration, gets no row", async () => {
  device({ touch: true, vibrate: true });
  await remount();
  expect(names()).toEqual(["Quality", "Frame rate", "Shadows", "Reduced motion", "Haptics"]);
  const haptics = () => host.querySelector('[role="switch"][aria-label="Haptics"]')!.getAttribute("aria-checked");
  const before = haptics();
  await toggle("Haptics");
  expect(haptics()).not.toBe(before);
  await toggle("Haptics");

  device({ touch: true, vibrate: false });
  await remount();
  expect(names()).not.toContain("Haptics");
});

it("saves Shadows at once without leaving the page, says it applies after a reload, and stops saying so when undone", async () => {
  await toggle("Shadows");
  expect(JSON.parse(localStorage.getItem("eternum-graphics")!)).toEqual({ quality: "high", shadows: false });
  expect(window.location.href).toBe(page);
  expect(reloadRow()).toBe(true);
  expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Reload")).toBe(true);

  await toggle("Shadows");
  expect(reloadRow()).toBe(false);
});

it("says a Quality or Frame rate choice applies after a reload", async () => {
  await choose("Quality", "Balanced");
  expect(JSON.parse(localStorage.getItem("eternum-graphics")!).quality).toBe("balanced");
  expect(reloadRow()).toBe(true);
  await choose("Quality", "High");
  expect(reloadRow()).toBe(false);

  await choose("Frame rate", "60 FPS");
  expect(localStorage.getItem("RENDER_MODE")).toBe("capped");
  expect(reloadRow()).toBe(true);
  await choose("Frame rate", "Uncapped");
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
  await toggle("Shadows");
  const assign = vi.fn();
  const reload = vi.fn();
  const location = vi
    .spyOn(window, "location", "get")
    .mockReturnValue({ href: window.location.href, assign, reload } as unknown as Location);
  await act(async () =>
    [...host.querySelectorAll("button")].find((button) => button.textContent === "Reload")!.click(),
  );
  location.mockRestore();
  expect([assign.mock.calls.length, reload.mock.calls.length]).toEqual([0, 1]);
  window.history.replaceState(null, "", page);
});
