import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/ui/debug/renderer-debug-control", () => ({
  RENDERER_MODES: [
    { label: "WebGPU", mode: "webgpu-auto" },
    { label: "WebGL2", mode: "webgpu-force-webgl" },
  ],
  requestedRendererMode: () => "webgpu-auto",
}));

import { VideoSettings } from "./video-settings";

let host: HTMLDivElement;
let root: Root;
const page = window.location.href;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<VideoSettings />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
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

it("names each row without a line under it, and offers a reload only once a change waits for one", () => {
  expect(names()).toEqual(["Quality", "Frame rate", "Renderer", "Shadows", "Reduced motion", "Haptics"]);
  expect(host.querySelector(".ui-setting__about")).toBeNull();
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

it("says a Quality, Frame rate or Renderer choice applies after a reload", async () => {
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

  await choose("Renderer", "WebGL2");
  expect(reloadRow()).toBe(true);
  expect(window.location.href).toBe(page);
});

it("applies Reduced motion at once, with nothing to reload", async () => {
  const motion = () => host.querySelector('[role="switch"][aria-label="Reduced motion"]')!.getAttribute("aria-checked");
  const before = motion();
  await toggle("Reduced motion");
  expect(motion()).not.toBe(before);
  expect(reloadRow()).toBe(false);
  await toggle("Reduced motion");
});

it("keeps a renderer chosen and another setting through closing Settings, and reloads onto both with the page kept", async () => {
  window.history.replaceState(null, "", "/g/0x1/6/map?spectate=true");
  await choose("Renderer", "WebGL2");
  await choose("Quality", "Balanced");
  // Settings closes (its panel unmounts) and opens again.
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(<VideoSettings />));
  expect(host.querySelector(".ui-select[aria-label='Renderer']")!.textContent).toBe("WebGL2");
  expect(host.querySelector(".ui-select[aria-label='Quality']")!.textContent).toBe("Balanced");
  expect(reloadRow()).toBe(true);

  const assign = vi.fn();
  const reload = vi.fn();
  const location = vi
    .spyOn(window, "location", "get")
    .mockReturnValue({ href: window.location.href, assign, reload } as unknown as Location);
  await act(async () =>
    [...host.querySelectorAll("button")].find((button) => button.textContent === "Reload")!.click(),
  );
  location.mockRestore();
  expect(reload).not.toHaveBeenCalled();
  const target = new URL(assign.mock.calls[0][0]);
  expect([target.pathname, Object.fromEntries(target.searchParams)]).toEqual([
    "/g/0x1/6/map",
    { spectate: "true", rendererMode: "webgpu-force-webgl" },
  ]);
  // Undone, nothing waits for a reload.
  await choose("Renderer", "WebGPU");
  await choose("Quality", "High");
  expect(reloadRow()).toBe(false);
  window.history.replaceState(null, "", page);
});

it("reloads the page as it is when no renderer choice waits", async () => {
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
});
