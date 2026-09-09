import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/hooks/useAudio", () => ({ useAudio: () => ({ play: vi.fn() }) }));

import { Popover, PopoverPanel, SurfaceHost } from "./popover";

const Trigger = ({ id, label }: { id: string; label: string }) => {
  const toggle = usePopoverStore((state) => state.toggle);
  return (
    <button type="button" onClick={() => toggle(id)}>
      {label}
    </button>
  );
};

const TwoPopovers = () => (
  <>
    <SurfaceHost />
    <Popover id="a" ariaLabel="A" trigger={<Trigger id="a" label="open a" />}>
      <span>panel a</span>
    </Popover>
    <Popover id="b" ariaLabel="B" trigger={<Trigger id="b" label="open b" />}>
      <span>panel b</span>
    </Popover>
  </>
);

/** The compact lane is one media query (`use-compact-hud`); the popover reads it, so the test drives it. */
const stubCompactViewport = (matches: boolean) =>
  vi.stubGlobal("matchMedia", () => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

const panel = (id: string) => document.querySelector<HTMLElement>(`[data-popover-panel="${id}"]`);
const trigger = (label: string) =>
  [...document.querySelectorAll("button")].find((button) => button.textContent === label)!;

describe("Popover", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    usePopoverStore.setState({ openId: null });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<TwoPopovers />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("keeps a tall map picker within a 1600 by 900 viewport even near the bottom edge", async () => {
    vi.stubGlobal("innerHeight", 900);
    vi.stubGlobal("innerWidth", 1600);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1400);
    await act(async () =>
      usePopoverStore.getState().openSurface({
        id: "plot-construction",
        content: <div>Buildings</div>,
        anchor: { left: 1200, right: 1200, top: 850, bottom: 850 },
        mapClick: "dismiss",
      }),
    );
    const picker = panel("plot-construction")!;
    expect(picker.style.top).toBe("56px");
    expect(picker.style.maxHeight).toBe("836px");
    expect(picker.className).toContain("overflow-y-auto");
  });

  it("collapses every anchor to a bottom sheet on a compact viewport", async () => {
    stubCompactViewport(true);
    const onDismiss = vi.fn();
    const anchors = [
      "top-center",
      "right-edge",
      "bottom-right",
      { left: 40, right: 80, top: 300, bottom: 340 },
    ] as const;
    for (const anchor of anchors) {
      const sheetContainer = document.createElement("div");
      document.body.appendChild(sheetContainer);
      const sheetRoot = createRoot(sheetContainer);
      await act(async () =>
        sheetRoot.render(
          <PopoverPanel id="sheet" ariaLabel="Sheet" anchor={anchor} onDismiss={onDismiss}>
            <span>sheet body</span>
          </PopoverPanel>,
        ),
      );
      const sheet = panel("sheet")!;
      expect(sheet.style.left).toBe("0px");
      expect(sheet.style.right).toBe("0px");
      expect(sheet.style.bottom).toBe("0px");
      expect(sheet.style.top).toBe("");
      expect(sheet.style.maxWidth).toBe("100vw");
      // jsdom drops the matching `max(..., env(...))` padding value, so the height budget stands in for both.
      expect(sheet.style.maxHeight).toContain("85dvh");
      expect(sheet.style.maxHeight).toContain("safe-area-inset-bottom");
      expect(sheet.className).toContain("max-lg:w-screen");
      expect(sheet.className).toContain("touch-pan-y");
      await act(async () => sheetRoot.unmount());
      sheetContainer.remove();
    }
  });

  it("keeps the anchored placement from Tailwind's lg breakpoint up", async () => {
    stubCompactViewport(false);
    await act(async () => trigger("open a").click());
    expect(panel("a")!.style.bottom).toBe("");
    expect(panel("a")!.style.top).not.toBe("");
  });

  it("anchors the panel on the body without a scrim", async () => {
    await act(async () => trigger("open a").click());

    const panelA = panel("a");
    expect(panelA?.parentElement).toBe(document.body);
    expect(panelA?.getAttribute("role")).toBe("dialog");
    expect(document.body.querySelectorAll('[class*="inset-0"]')).toHaveLength(0);
  });

  it("keeps at most one popover open", async () => {
    await act(async () => trigger("open a").click());
    await act(async () => trigger("open b").click());

    expect(panel("a")).toBeNull();
    expect(panel("b")).not.toBeNull();
    expect(usePopoverStore.getState().openId).toBe("b");
  });

  it("toggles from its own trigger and closes on Escape", async () => {
    await act(async () => trigger("open a").click());
    await act(async () => trigger("open a").click());
    expect(panel("a")).toBeNull();

    await act(async () => trigger("open a").click());
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(panel("a")).toBeNull();
  });

  it("closes on a pointer-down outside and stays open for one inside", async () => {
    await act(async () => trigger("open a").click());
    await act(async () => {
      panel("a")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(panel("a")).not.toBeNull();

    await act(async () => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(panel("a")).toBeNull();
  });

  it("reanchors map clicks without unmounting content, dismisses other map hits, and preserves Escape", async () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const onDismiss = vi.fn();
    const reanchor = vi.fn(() => true);
    const renderDrawer = (left: number) =>
      root.render(
        <PopoverPanel
          id="map-drawer"
          ariaLabel="Map drawer"
          anchor={{ left, right: left, top: 80, bottom: 80 }}
          mapClick={{ reanchor }}
          onDismiss={onDismiss}
        >
          <input aria-label="Count" defaultValue="100" />
        </PopoverPanel>,
      );
    await act(async () => renderDrawer(100));
    const input = panel("map-drawer")!.querySelector("input")!;
    input.value = "500";
    await act(async () => canvas.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(reanchor).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => renderDrawer(300));
    expect(panel("map-drawer")!.style.left).toBe("300px");
    expect(panel("map-drawer")!.querySelector("input")).toBe(input);
    expect(input.value).toBe("500");
    reanchor.mockReturnValue(false);
    await act(async () => canvas.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(reanchor).toHaveBeenCalledTimes(2);
    expect(onDismiss).toHaveBeenCalledTimes(2);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(onDismiss).toHaveBeenCalledTimes(3);
    canvas.remove();
  });

  it("dismisses map clicks by default and forwards a store surface's map policy", async () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    await act(async () => trigger("open a").click());
    await act(async () => canvas.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(panel("a")).toBeNull();
    const reanchor = vi.fn(() => true);
    await act(async () =>
      usePopoverStore.getState().openSurface({ id: "map", content: "picker", mapClick: { reanchor } }),
    );
    await act(async () => canvas.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(reanchor).toHaveBeenCalledTimes(1);
    expect(panel("map")).not.toBeNull();
    canvas.remove();
  });

  it("renders a store surface through the same panel and closes it on Escape", async () => {
    await act(async () => {
      usePopoverStore.getState().openSurface({ id: "s", content: <span>surface body</span> });
    });
    expect(panel("s")?.textContent).toBe("surface body");
    expect(panel("s")?.parentElement).toBe(document.body);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(panel("s")).toBeNull();
    expect(usePopoverStore.getState().surface).toBeNull();
  });

  it("a surface and an element popover are exclusive of each other", async () => {
    await act(async () => {
      usePopoverStore.getState().openSurface({ id: "s", content: <span>surface body</span> });
    });
    await act(async () => trigger("open a").click());
    expect(panel("s")).toBeNull();
    expect(panel("a")).not.toBeNull();

    await act(async () => {
      usePopoverStore.getState().openSurface({ id: "s", content: <span>surface body</span> });
    });
    expect(panel("a")).toBeNull();
    expect(panel("s")).not.toBeNull();
  });

  it("a store-free panel hangs from a viewport edge and asks its owner to close on Escape", async () => {
    const onDismiss = vi.fn();
    const edgeContainer = document.createElement("div");
    document.body.appendChild(edgeContainer);
    const edgeRoot = createRoot(edgeContainer);
    await act(async () =>
      edgeRoot.render(
        <PopoverPanel id="drawer" ariaLabel="Drawer" anchor="bottom-right" onDismiss={onDismiss}>
          <span>drawer body</span>
        </PopoverPanel>,
      ),
    );

    const drawer = panel("drawer")!;
    expect(drawer.style.bottom).toBe("8px");
    expect(drawer.style.right).toBe("8px");
    expect(drawer.style.top).toBe("");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    await act(async () => edgeRoot.unmount());
    edgeContainer.remove();
  });
});
