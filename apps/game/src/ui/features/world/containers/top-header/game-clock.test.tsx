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
it("merges the countdown with the phase icon, time left in phase and six segments", async () => {
  await render();
  expect(container.textContent).toBe("Starts in 1m 00s0m 30s");
  expect(container.querySelector('[role="progressbar"]')).toBeNull();
  mocks.now = 120;
  await render();
  expect(container.textContent).toBe("10m 00s left0m 30s");
  expect(container.querySelector('[aria-label="Dawn"]')).not.toBeNull();
  const progress = container.querySelector('[role="progressbar"]')!;
  expect(progress.getAttribute("aria-label")).toBe("Dawn progress");
  expect(progress.getAttribute("aria-valuenow")).toBe("50");
  expect(progress.children).toHaveLength(6);
  expect(progress.children[1].firstElementChild?.getAttribute("style")).toContain("width: 50%");
  expect(container.querySelector('[aria-label="Game clock"]')?.getAttribute("title")).toBe(
    "Dawn · phase 2 of 6\nDay length 6m 00s\n0m 30s left in dawn",
  );
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

it("stacks a concise mobile countdown while preserving its full accessible label", async () => {
  mocks.now = 120;
  mocks.gameEndAt = 90120;
  try {
    await act(async () => root.render(<GameClock compact />));
    expect(container.textContent).toBe("1d 1h left0m 30s");
    expect(container.querySelector('[aria-label="1d 01h 0m 00s left"]')).not.toBeNull();
  } finally {
    mocks.gameEndAt = 720;
  }
});
