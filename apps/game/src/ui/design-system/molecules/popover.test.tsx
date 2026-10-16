import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COMPACT_HUD_MEDIA_QUERY } from "@/hooks/helpers/use-compact-hud";
import type { SurfaceAnchor } from "@/hooks/store/use-popover-store";

import { PopoverPanel, SurfaceFrame } from "./popover";

/** Where an order was given on the map: a tile low on the right of a 1440×900 screen. */
const TILE: SurfaceAnchor = { left: 1200, right: 1200, top: 700, bottom: 700 };
const CONTENT_HEIGHT = 400;

const fullModal = (
  <SurfaceFrame title="Transfer Troops & Relics" onClose={() => {}}>
    <p>Troops</p>
  </SurfaceFrame>
);
const smallPopover = <div>Attack?</div>;

/** The screen, as the panel's media queries and its own measurements see it. */
const useScreen = (width: number, height: number) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === COMPACT_HUD_MEDIA_QUERY && width < 1024,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

/** The panel placed for `content` opened from `anchor`, and how to close it. */
const openPanel = async (anchor: Parameters<typeof PopoverPanel>[0]["anchor"], content: ReactNode) => {
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <PopoverPanel id="surface" ariaLabel="surface" anchor={anchor} onDismiss={() => {}}>
        {content}
      </PopoverPanel>,
    ),
  );
  const panel = document.querySelector<HTMLElement>('[data-popover-panel="surface"]');
  return { style: () => panel?.style, close: () => act(async () => root.unmount()) };
};

/** Where the panel stands once placed. */
const placedStyle = async (anchor: Parameters<typeof PopoverPanel>[0]["anchor"], content: ReactNode) => {
  const opened = await openPanel(anchor, content);
  const { top, left, right, transform } = opened.style() ?? {};
  await opened.close();
  return { top, left, right, transform };
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(CONTENT_HEIGHT);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("on desktop", () => {
  beforeEach(() => useScreen(1440, 900));

  it("stands a full modal opened from a map tile in the middle of the screen", async () => {
    const style = await placedStyle(TILE, fullModal);
    // Centred below the header (56 px): (900 - 56 - 8 - 400) / 2 = 218.
    expect([style.left, style.transform, style.top]).toEqual(["50%", "translateX(-50%)", "274px"]);
  });

  it("stands a full modal opened with no anchor in the same place", async () => {
    const style = await placedStyle("top-center", fullModal);
    expect([style.left, style.transform, style.top]).toEqual(["50%", "translateX(-50%)", "274px"]);
  });

  it("stays in the middle when its content grows after it opened", async () => {
    let contentResized = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          contentResized = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const opened = await openPanel(TILE, fullModal);
    expect(opened.style()?.top).toBe("274px");
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(600);
    await act(async () => contentResized());
    // (900 - 56 - 8 - 600) / 2 = 118.
    expect(opened.style()?.top).toBe("174px");
    await opened.close();
  });

  it("keeps a small popover hanging from the tile it was opened at", async () => {
    const style = await placedStyle(TILE, smallPopover);
    // No room below the tile for its 400 px, so it hangs above it: 700 - 8 - 400.
    expect([style.left, style.transform, style.top]).toEqual(["1200px", "", "292px"]);
  });

  it("keeps a full modal set against a side of the screen there", async () => {
    const style = await placedStyle("right-edge", fullModal);
    expect([style.right, style.left, style.top]).toEqual(["8px", "", "56px"]);
  });
});

describe("on a phone", () => {
  beforeEach(() => useScreen(390, 844));

  it("opens a full modal from a map tile as the bottom sheet, like any surface", async () => {
    const modal = await placedStyle(TILE, fullModal);
    const popover = await placedStyle(TILE, smallPopover);
    expect([modal.left, modal.right, modal.top]).toEqual(["0px", "0px", ""]);
    expect([popover.left, popover.right, popover.top]).toEqual(["0px", "0px", ""]);
  });
});
