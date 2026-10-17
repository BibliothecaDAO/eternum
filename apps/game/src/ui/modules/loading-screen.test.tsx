import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";

import { markGameEntryMilestone } from "@/ui/layouts/game-entry-timeline";
import { LoadingScreen } from "./loading-screen";

const unmounts: (() => Promise<void>)[] = [];

/** The loading screen as the page at `url` shows it, after the boot recorded a milestone. */
const showLoadingScreen = async (url: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, "", url);
  markGameEntryMilestone("asset-prefetch-scheduled");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<LoadingScreen />));
  unmounts.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};

afterEach(async () => {
  while (unmounts.length > 0) await unmounts.pop()!();
  window.history.replaceState(null, "", "/");
});

it("shows a player entering a game no diagnostics: no timeline, no renderer switch", async () => {
  const screen = await showLoadingScreen("/g/0x1/2/map");
  expect(screen.textContent).toContain("Entering the World");
  expect(screen.textContent).not.toMatch(/debug|elapsed|milestone|asset-prefetch-scheduled/);
  expect(screen.querySelector('[data-testid="renderer-debug-control"]')).toBeNull();
});

it("shows the boot's timeline and renderer switch only on a page opened with the diagnostics opt-in", async () => {
  const screen = await showLoadingScreen("/g/0x1/2/map?logs=1");
  expect(screen.textContent).toContain("debug");
  expect(screen.textContent).toContain("asset-prefetch-scheduled");
  expect(screen.querySelector('[data-testid="renderer-debug-control"]')).not.toBeNull();
});
