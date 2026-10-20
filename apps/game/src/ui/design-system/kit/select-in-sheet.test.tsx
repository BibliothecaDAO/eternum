import { act, type ReactNode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COMPACT_HUD_MEDIA_QUERY } from "@/hooks/helpers/use-compact-hud";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { SurfaceFrame, SurfaceHost } from "@/ui/design-system/molecules/popover";

import { AppDialog } from "./app-elements";
import { HudSelect, HudSheet } from "./hud-elements";
import { Sheet } from "./sheet";

vi.mock("@/utils/can-issue-orders", () => ({ refusedBeforePlay: () => false }));
vi.mock("@/audio/hooks/useAudio", () => ({ useAudio: () => ({ play: () => {} }) }));

const SCREENS = { phone: [390, 844], desktop: [1440, 900] } as const;

const useScreen = ([width, height]: readonly [number, number]) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === COMPACT_HUD_MEDIA_QUERY && width < 1024,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

/** Production's Resource select, as the QA report took it: its list is drawn over every surface, outside the sheet. */
const ResourceSelect = ({ onChange }: { onChange: (value: string) => void }) => (
  <HudSelect
    label="Resource"
    value=""
    options={[
      { value: "", label: "Select a resource" },
      { value: "labor", label: "Labor" },
      { value: "crossbowman-t1", label: "Crossbowman T1" },
    ]}
    onChange={onChange}
  />
);

/**
 * Each surface a select can stand in, opened as the game opens it, with how to tell it is still open and how a player
 * closes it from outside.
 */
const SURFACES: {
  name: string;
  open: (select: ReactNode, onClose: () => void) => Promise<void>;
  isOpen: () => boolean;
  pressOutside: () => void;
}[] = [
  {
    // The workspaces (Production, Build) and Settings: the store's surface, a bottom sheet on a phone.
    name: "a HUD panel (Production, Build, Settings)",
    open: async (select, onClose) => {
      await render(<SurfaceHost />);
      await act(async () =>
        usePopoverStore.getState().openSurface({
          id: "production",
          content: (
            <SurfaceFrame title="Production" onClose={onClose}>
              {select}
            </SurfaceFrame>
          ),
        }),
      );
    },
    isOpen: () => document.querySelector('[data-popover-panel="production"]') !== null,
    pressOutside: () => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
  },
  {
    name: "a HUD sheet",
    open: (select, onClose) =>
      render(
        <OpenWhile
          onClose={onClose}
          sheet={(close) => (
            <HudSheet label="Army" onClose={close}>
              {select}
            </HudSheet>
          )}
        />,
      ),
    isOpen: () => document.querySelector(".ui-sheet__backdrop") !== null,
    pressOutside: () => document.querySelector<HTMLButtonElement>(".ui-sheet__backdrop")!.click(),
  },
  {
    name: "the kit sheet",
    open: (select, onClose) =>
      render(
        <OpenWhile
          onClose={onClose}
          sheet={(close) => (
            <Sheet label="Build" onClose={close}>
              {select}
            </Sheet>
          )}
        />,
      ),
    isOpen: () => document.querySelector(".frontier-sheet") !== null,
    pressOutside: () => document.querySelector<HTMLButtonElement>("button[aria-hidden]")!.click(),
  },
  {
    name: "an app dialog over the page",
    open: (select, onClose) =>
      render(
        <OpenWhile
          onClose={onClose}
          sheet={(close) => (
            <AppDialog title="Remove?" actions={null} onClose={close}>
              {select}
            </AppDialog>
          )}
        />,
      ),
    isOpen: () => document.querySelector(".app-scrim") !== null,
    pressOutside: () => document.querySelector<HTMLElement>(".app-scrim")!.click(),
  },
];

/** A sheet shown until it asks to close, as its caller holds it. */
const OpenWhile = ({ onClose, sheet }: { onClose: () => void; sheet: (close: () => void) => ReactNode }) => {
  const [open, setOpen] = useState(true);
  return open ? sheet(() => (setOpen(false), onClose())) : null;
};

let roots: Root[] = [];
const render = async (node: ReactNode) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(node));
};

/** A tap on an item of the open list, as a finger gives it: down, up, then the click. */
const tap = async (element: Element) => {
  await act(async () => {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    (element as HTMLElement).click();
  });
};

const openList = async () => {
  await act(async () => document.querySelector<HTMLButtonElement>('.ui-select[aria-label="Resource"]')!.click());
  return [...document.querySelectorAll(".ui-select__layer .ui-menu__item")];
};

const focus = HTMLElement.prototype.focus;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // As a browser does: a list still hidden (not yet placed) can't take focus.
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
    if (!this.closest('.ui-select__layer[data-placed="false"]')) focus.call(this, options);
  });
});

afterEach(async () => {
  for (const root of roots) await act(async () => root.unmount());
  roots = [];
  usePopoverStore.getState().close();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(Object.entries(SCREENS))("on a %s", (_, screen) => {
  beforeEach(() => useScreen(screen));

  it.each(SURFACES)("$name keeps open while a choice is taken from a select inside it", async (surface) => {
    const closed = vi.fn();
    const chosen = vi.fn();
    await surface.open(<ResourceSelect onChange={chosen} />, closed);

    const items = await openList();
    const crossbow = items.find((item) => item.textContent === "Crossbowman T1")!;
    await tap(crossbow);
    expect([chosen.mock.calls, closed.mock.calls.length, surface.isOpen()]).toEqual([[["crossbowman-t1"]], 0, true]);

    // The open list holds the keys, so Escape closes the list, not the surface.
    await openList();
    expect(document.activeElement?.closest(".ui-select__layer")).not.toBeNull();
    await act(async () =>
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect([document.querySelector(".ui-select__layer"), closed.mock.calls.length, surface.isOpen()]).toEqual([
      null,
      0,
      true,
    ]);

    // A press outside still closes the surface.
    await act(async () => surface.pressOutside());
    expect(surface.isOpen()).toBe(false);
  });
});
