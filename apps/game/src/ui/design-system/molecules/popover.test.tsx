import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COMPACT_HUD_MEDIA_QUERY } from "@/hooks/helpers/use-compact-hud";
import { type SurfaceAnchor, usePopoverStore } from "@/hooks/store/use-popover-store";

import { HudWindow } from "@/ui/design-system/kit/hud-elements";

import { PopoverPanel, SurfaceFrame, SurfaceHost } from "./popover";
import { dragHeader, panelOf, placementOf } from "./surface-panel-testing";

// Play is open, and the HUD's sounds are not this test's business.
vi.mock("@/utils/can-issue-orders", () => ({ refusedBeforePlay: () => false }));
vi.mock("@/audio/hooks/useAudio", () => ({ useAudio: () => ({ play: () => {} }) }));

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

describe("a desk the player dragged, opened again", () => {
  const hosts: Array<ReturnType<typeof createRoot>> = [];
  beforeEach(() => useScreen(1440, 900));
  afterEach(async () => {
    await act(async () => usePopoverStore.getState().close());
    await act(async () => hosts.splice(0).forEach((host) => host.unmount()));
    window.localStorage.clear();
  });

  const CENTRED = ["translateX(-50%)", "274px"];
  const DRAGGED = ["translateX(-50%) translate(300px, 200px)", "274px"];

  /** The HUD's one surface host. */
  const mountHost = async () => {
    const root = createRoot(document.createElement("div"));
    hosts.push(root);
    await act(async () => root.render(<SurfaceHost />));
  };
  /** A full modal opened through the store, as the action strip opens Production and the name chip the leaderboard. */
  const openDesk = (id: string, body = id) =>
    act(async () =>
      usePopoverStore.getState().openSurface({
        id,
        content: (
          <SurfaceFrame title={id} onClose={() => {}}>
            <p>{body}</p>
          </SurfaceFrame>
        ),
      }),
    );
  const closeDesk = (id: string) => act(async () => usePopoverStore.getState().close(id));

  it("moves with the drag while open, and opens centred again after it is closed", async () => {
    await mountHost();
    await openDesk("production");
    await dragHeader("production", { x: 300, y: 200 });
    expect(placementOf("production")).toEqual(DRAGGED);
    await closeDesk("production");
    await openDesk("production");
    expect(placementOf("production")).toEqual(CENTRED);
  });

  it("opens the desk that replaces a dragged one centred, with no close between them", async () => {
    await mountHost();
    await openDesk("production");
    await dragHeader("production", { x: 300, y: 200 });
    await openDesk("leaderboard");
    expect([panelOf("production"), placementOf("leaderboard")]).toEqual([null, CENTRED]);
  });

  it("keeps a dragged desk where it was when the same surface is aimed again", async () => {
    await mountHost();
    await openDesk("help", "the realm");
    await dragHeader("help", { x: 300, y: 200 });
    await openDesk("help", "another army");
    expect([panelOf("help")?.textContent?.includes("another army"), placementOf("help")]).toEqual([true, DRAGGED]);
  });

  it("leaves a HUD window its own surface, centres it and drags it by its bar", async () => {
    await mountHost();
    await act(async () =>
      usePopoverStore.getState().openSurface({
        id: "transfer",
        content: (
          <HudWindow title="Transfer" size="workspace" onClose={() => {}}>
            <p>Send from</p>
          </HudWindow>
        ),
      }),
    );
    const panel = panelOf("transfer")!;
    // The window is the surface: the panel draws no box, padding or width of its own around it.
    expect(["rounded-xl", "p-4", "w-80", "w-auto"].filter((look) => panel.classList.contains(look))).toEqual([]);
    expect(panel.firstElementChild?.classList.contains("ui-window")).toBe(true);
    expect(placementOf("transfer")).toEqual(CENTRED);
    await dragHeader("transfer", { x: 300, y: 200 });
    expect(placementOf("transfer")).toEqual(DRAGGED);
  });

  it("frames a SurfaceFrame as the sheet's window, with no panel box around it, and still drags it by its bar", async () => {
    await mountHost();
    await act(async () => usePopoverStore.getState().openSurface({ id: "transfer", content: fullModal }));
    const panel = panelOf("transfer")!;
    expect(panel.classList.contains("ui-popover")).toBe(false);
    const frame = panel.firstElementChild!;
    expect(frame.classList.contains("ui-window")).toBe(true);
    expect(frame.querySelector(".ui-window__bar")?.hasAttribute("data-popover-drag-handle")).toBe(true);
    expect(frame.querySelector('button[aria-label="Close"]')).not.toBeNull();
    expect(placementOf("transfer")).toEqual(CENTRED);
    await dragHeader("transfer", { x: 300, y: 200 });
    expect(placementOf("transfer")).toEqual(DRAGGED);
  });

  it("draws a small popover in the sheet's panel look, sized and padded by the panel", async () => {
    const opened = await openPanel(TILE, smallPopover);
    const panel = document.querySelector<HTMLElement>('[data-popover-panel="surface"]')!;
    expect(["ui", "ui-popover", "w-80", "p-4", "rounded-xl"].every((look) => panel.classList.contains(look))).toBe(
      true,
    );
    await opened.close();
  });

  it("opens centred for a player whose browser still holds a position saved by an older client", async () => {
    window.localStorage.setItem("eternum.free-surface-offset", JSON.stringify({ x: 300, y: 200 }));
    await mountHost();
    await openDesk("production");
    expect(placementOf("production")).toEqual(CENTRED);
  });
});
