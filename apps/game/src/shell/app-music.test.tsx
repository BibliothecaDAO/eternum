import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/audio/core/AudioManager", () => ({ AudioManager: { getInstance: () => ({ setMuted: vi.fn() }) } }));

import { setAppMusic, useAppMusic } from "./app-music";

const Shown = () => <p>{useAppMusic() ? "on" : "off"}</p>;

const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Shown />));
  return { shown: () => container.textContent, unmount: () => act(async () => root.unmount()) };
};

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

it("stays off until the player turns it on, and a later visit finds it as it was left", async () => {
  const first = await mount();
  expect(first.shown()).toBe("off");
  await act(async () => setAppMusic(true));
  expect(first.shown()).toBe("on");
  await first.unmount();

  const later = await mount();
  expect(later.shown()).toBe("on");
  await act(async () => setAppMusic(false));
  expect(later.shown()).toBe("off");
  await later.unmount();
});
