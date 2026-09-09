import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cycleProgress: 25, gameStartMainAt: 120, gameEndAt: 720, now: 60 }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: (select: any) => select(mocks) }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentBlockTimestamp: () => mocks.now }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getTick: () => 60 } }));
vi.mock("./game-finished-pill", () => ({ GameFinishedPill: () => <button>Game finished</button> }));
import { GameClock } from "./game-clock";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.now = 60;
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});
// Explicit key exercises the memoized presentation with a new fixture timestamp.
const render = () => act(async () => root.render(<GameClock key={mocks.now} />));
it("renders only one clock with no phase names or percent", async () => {
  await render();
  expect(container.textContent).toBe("Starts in 1m 00s");
  expect(container.querySelector('[role="progressbar"]')).toBeNull();
  mocks.now = 120;
  await render();
  expect(container.textContent).toBe("10m 00s left");
  expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-label")).toBe("Dawn progress");
  expect(container.querySelector('[aria-label="Game clock"]')?.getAttribute("title")).toBe("Dawn");
});
it("retains urgency and the finished review entry", async () => {
  mocks.now = 600;
  await render();
  expect(document.body.classList.contains("urgency-border-critical")).toBe(true);
  mocks.now = 720;
  await render();
  expect(container.textContent).toBe("Game finished");
  expect(document.body.className).not.toContain("urgency-border");
});
