import { LeftView } from "@/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { StoreApi, UseBoundStore } from "zustand";

interface TestUiState {
  leftNavigationView: LeftView;
  pendingRenameStructureEntityId: number | null;
  setLeftNavigationView: (view: LeftView) => void;
  setPendingRenameStructureEntityId: (id: number | null) => void;
  showBlankOverlay: boolean;
  isSpectating: boolean;
  selectedHex: { col: number; row: number } | null;
  selectedBuildingHex: { outerCol: number; outerRow: number; innerCol: number; innerRow: number } | null;
}

const mocks = vi.hoisted(() => ({ rows: [] as { at: number }[] }));
vi.mock("@/hooks/store/use-ui-store", async () => {
  const { create } = await import("zustand");
  return {
    useUIStore: create<TestUiState>((set) => ({
      leftNavigationView: 0,
      pendingRenameStructureEntityId: null,
      setLeftNavigationView: (view) => set({ leftNavigationView: view }),
      setPendingRenameStructureEntityId: (id) => set({ pendingRenameStructureEntityId: id }),
      showBlankOverlay: false,
      isSpectating: false,
      selectedHex: null,
      selectedBuildingHex: null,
    })),
  };
});
vi.mock("@/utils/can-issue-orders", () => ({
  canIssueOrders: (state: { isSpectating: boolean }) => !state.isSpectating,
}));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: unknown) => unknown) => select({ account: { address: "0x1" } }),
}));
vi.mock("@/ui/features/event-feed/quick-feed", () => ({
  useImportantFeed: () => ({ nowMs: 0, rows: mocks.rows, pinned: [] }),
  useUnreadFeedCount: (rows: unknown[], logOpen: boolean) => (logOpen ? 0 : rows.length),
  useConnectionNotices: () => undefined,
  FeedNotices: () => null,
  UnreadFeedBadge: ({ count }: { count: number }) =>
    count > 0 ? <span aria-label="Unread events">{count}</span> : null,
}));
vi.mock("@/ui/features/event-feed/event-log-panel", () => ({
  EventLogPanel: () => <div role="dialog">Log panel</div>,
}));
vi.mock("@/ui/features/world/components/bottom-right-panel", async () => {
  const { useUIStore } = await import("@/hooks/store/use-ui-store");
  return {
    MinimapPanel: () => <article>Minimap</article>,
    useSelectedTileDetails: () => {
      const selectedBuildingHex = useUIStore((state: TestUiState) => state.selectedBuildingHex);
      const selectedHex = useUIStore((state: TestUiState) => state.selectedHex);
      if (selectedBuildingHex) return <article>Local tile</article>;
      if (selectedHex) return <article>Map tile</article>;
      return null;
    },
  };
});
vi.mock("@/ui/features/social", () => ({
  useRealtimeChatSelector: (select: (state: { unreadWorldTotal: number; unreadDirectTotal: number }) => number) =>
    select({ unreadWorldTotal: 0, unreadDirectTotal: 0 }),
}));
vi.mock("./hud-chat-window", () => ({
  HudChatWindow: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <button aria-label="Chat strip" aria-expanded={open} onClick={() => onOpenChange(!open)}>
      Chat strip
    </button>
  ),
}));
vi.mock("./left-facets/structure-list-column", () => ({ StructureListColumn: () => <article>Structures</article> }));
vi.mock("./left-facets/empire-cockpit", () => ({ EmpireCockpit: () => <article>Cockpit</article> }));
vi.mock("./spectator-standings", () => ({ SpectatorStandingsBody: () => <article>Standings</article> }));
import { useUIStore } from "@/hooks/store/use-ui-store";
import { CompactHud } from "./compact-hud";
import { usePopoverStore } from "@/hooks/store/use-popover-store";

const store = useUIStore as unknown as UseBoundStore<StoreApi<TestUiState>>;

let container: HTMLDivElement;
let root: Root;
const tab = (label: string) => container.querySelector<HTMLButtonElement>(`nav [aria-label="${label}"]`);
const tabLabels = () =>
  [...container.querySelectorAll("nav button")].map((button) => button.getAttribute("aria-label"));
const sheet = () => container.querySelector('[aria-label="HUD sheet"]');
const sheetContent = () =>
  [...(sheet()?.querySelectorAll("article") ?? [])].map((element) => element.textContent).join("");
const tap = (label: string) => act(async () => tab(label)!.click());

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  usePopoverStore.getState().close();
  mocks.rows = [];
  store.setState({
    leftNavigationView: LeftView.None,
    pendingRenameStructureEntityId: null,
    showBlankOverlay: false,
    isSpectating: false,
    selectedHex: null,
    selectedBuildingHex: null,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<CompactHud lane="portrait" />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("keeps all five navigation targets stable before a tile is selected", () => {
  expect(tabLabels()).toEqual(["Empire", "Map", "Log", "Chat", "Details"]);
  expect(sheet()).toBeNull();
  expect(container.querySelector('[aria-label="Compact HUD"]')?.className).toContain("pointer-events-none");
});

it("docks to the right edge as a column and a vertical rail in landscape, with the sheet filling the column", async () => {
  await act(async () => root.render(<CompactHud key="landscape" lane="landscape" />));
  const shell = container.querySelector('[aria-label="Compact HUD"]')!;
  expect(shell.className).toContain("flex-row");
  expect(shell.className).toContain("safe-area-inset-top");
  expect(shell.className).not.toContain("inset-x-0");
  expect(container.querySelector("nav")?.className).toContain("flex-col");
  await tap("Map");
  expect(sheet()?.className).toContain("flex-1");
  expect(sheet()?.className).not.toContain("max-h-[55dvh]");
});

it("opens one sheet at a time and closes it when the active tab is tapped again", async () => {
  await tap("Map");
  expect(tab("Map")?.getAttribute("aria-expanded")).toBe("true");
  expect(sheetContent()).toBe("Minimap");
  expect(sheet()?.querySelector(".touch-pan-y")).not.toBeNull();
  await tap("Empire");
  expect(sheetContent()).toBe("StructuresCockpit");
  expect(tab("Map")?.getAttribute("aria-expanded")).toBe("false");
  await tap("Empire");
  expect(sheet()).toBeNull();
});

it("hosts the standings for a spectator", async () => {
  await act(async () => store.setState({ isSpectating: true }));
  expect(tabLabels()[0]).toBe("Standings");
  await tap("Standings");
  expect(sheetContent()).toBe("Standings");
});

it("counts unread events on the Log tab and opens the log panel instead of the sheet", async () => {
  mocks.rows = [{ at: 1 }, { at: 2 }];
  await act(async () => root.render(<CompactHud key="with-rows" lane="portrait" />));
  expect(tab("Log")?.querySelector('[aria-label="Unread events"]')?.textContent).toBe("2");
  await tap("Log");
  expect(container.querySelector('[role="dialog"]')?.textContent).toBe("Log panel");
  expect(sheet()).toBeNull();
  expect(tab("Log")?.querySelector('[aria-label="Unread events"]')).toBeNull();
  await tap("Log");
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

it("opens the chat window from the Chat tab and lifts the shell above other surfaces", async () => {
  const strip = () => container.querySelector('[aria-label="Chat strip"]');
  expect(strip()?.parentElement?.className).toBe("hidden");
  await tap("Chat");
  expect(strip()?.parentElement?.className).not.toContain("hidden");
  expect(container.querySelector('[aria-label="Chat strip"]')?.getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelector('[aria-label="Compact HUD"]')?.className).toContain("z-[130]");
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Chat strip"]')!.click());
  expect(tab("Chat")?.getAttribute("aria-expanded")).toBe("false");
});

it("keeps the sheet closed on a new selection so the map stays free for the next tap", async () => {
  await act(async () => store.setState({ selectedHex: { col: 4, row: 7 } }));
  expect(sheet()).toBeNull();
  await act(async () => store.setState({ selectedHex: { col: 5, row: 7 } }));
  expect(sheet()).toBeNull();
  await tap("Details");
  expect(sheetContent()).toBe("Map tile");
});

it("keeps an open sheet on its tab as the selection changes or clears", async () => {
  await tap("Map");
  await act(async () => store.setState({ selectedHex: { col: 4, row: 7 } }));
  expect(tab("Map")?.getAttribute("aria-expanded")).toBe("true");
  await tap("Details");
  expect(sheetContent()).toBe("Map tile");
  await act(async () => store.setState({ selectedHex: null }));
  expect(tabLabels()).toContain("Details");
  expect(sheet()?.textContent).toContain("Tap a tile on the map");
});

it("follows the selected building hex over the selected world hex", async () => {
  await act(async () => store.setState({ selectedHex: { col: 5, row: 5 } }));
  await act(async () =>
    store.setState({ selectedBuildingHex: { outerCol: 1, outerRow: 1, innerCol: 2, innerRow: 3 } }),
  );
  await tap("Details");
  expect(sheetContent()).toBe("Local tile");
});

it("explains how to inspect a tile before a selection exists", async () => {
  await tap("Details");
  expect(sheet()?.textContent).toContain("Tap a tile on the map");
});

it("closes from the visible close control or Escape and restores focus to its tab", async () => {
  await tap("Map");
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close panel"]')!.click());
  expect(sheet()).toBeNull();
  expect(document.activeElement).toBe(tab("Map"));
  await tap("Empire");
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(sheet()).toBeNull();
  expect(document.activeElement).toBe(tab("Empire"));
});

it("dismisses the sheet when panning the world canvas, but allows interaction within the minimap", async () => {
  await tap("Map");
  await act(async () => sheet()!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  expect(sheet()).not.toBeNull();
  const canvas = document.createElement("canvas");
  canvas.addEventListener("pointerdown", (event) => event.stopImmediatePropagation(), true);
  document.body.append(canvas);
  try {
    await act(async () => canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    expect(sheet()).toBeNull();
  } finally {
    canvas.remove();
  }
});

it("replaces sheets with action popovers and does not resurrect them when the popover closes", async () => {
  await tap("Empire");
  await act(async () => usePopoverStore.getState().open("settings"));
  expect(sheet()).toBeNull();
  await act(async () => store.setState({ selectedHex: { col: 1, row: 2 } }));
  expect(sheet()).toBeNull();
  await act(async () => usePopoverStore.getState().close());
  expect(sheet()).toBeNull();
  await act(async () => usePopoverStore.getState().open("settings"));
  await tap("Map");
  expect(usePopoverStore.getState().openId).toBeNull();
  expect(sheetContent()).toBe("Minimap");
});

it.each([LeftView.ConstructionView, LeftView.MilitaryView, LeftView.ResourceArrivals])(
  "makes room for workspace %s without stacking the Empire sheet",
  async (view) => {
    await tap("Empire");
    await act(async () => store.setState({ leftNavigationView: view }));
    expect(sheet()).toBeNull();
    await act(async () => store.setState({ leftNavigationView: LeftView.None }));
    expect(sheet()).toBeNull();
    await act(async () => store.setState({ leftNavigationView: view }));
    await tap("Map");
    expect(store.getState().leftNavigationView).toBe(LeftView.None);
    expect(sheetContent()).toBe("Minimap");
  },
);

it("dismisses the sheet while renaming a structure", async () => {
  await tap("Empire");
  await act(async () => store.setState({ pendingRenameStructureEntityId: 1 }));
  expect(sheet()).toBeNull();
  await tap("Map");
  expect(store.getState().pendingRenameStructureEntityId).toBeNull();
  expect(sheetContent()).toBe("Minimap");
});
