import { LeftView } from "@/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { StoreApi, UseBoundStore } from "zustand";

type LogisticsTab = "arrivals" | "transfer" | "automation" | "balances";

interface TestUiState {
  leftNavigationView: LeftView;
  pendingRenameStructureEntityId: number | null;
  setLeftNavigationView: (view: LeftView) => void;
  setPendingRenameStructureEntityId: (id: number | null) => void;
  showBlankOverlay: boolean;
  isSpectating: boolean;
  selectedHex: { col: number; row: number } | null;
  selectedBuildingHex: { outerCol: number; outerRow: number; innerCol: number; innerRow: number } | null;
  structureEntityId: number;
  playerStructures: { entityId: number }[];
  transferPanelSourceId: number | null;
  setTransferPanelSourceId: (id: number | null) => void;
  logisticsActiveTab: LogisticsTab;
  setLogisticsActiveTab: (tab: LogisticsTab) => void;
  arrivedArrivalsNumber: number;
  pendingArrivalsNumber: number;
}

const mocks = vi.hoisted(() => ({ rows: [] as { at: number }[] }));
/** Referenced from the hoisted store factory, so it must be hoisted too. */
const { OWNED_STRUCTURE_ID } = vi.hoisted(() => ({ OWNED_STRUCTURE_ID: 11 }));
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
      structureEntityId: OWNED_STRUCTURE_ID,
      playerStructures: [{ entityId: OWNED_STRUCTURE_ID }],
      transferPanelSourceId: null,
      setTransferPanelSourceId: (id) => set({ transferPanelSourceId: id }),
      logisticsActiveTab: "arrivals",
      setLogisticsActiveTab: (tab) => set({ logisticsActiveTab: tab }),
      arrivedArrivalsNumber: 0,
      pendingArrivalsNumber: 0,
    })),
  };
});
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ ui: { showTradeMenu: true } }),
}));
vi.mock("@/ui/config", () => ({
  BuildingThumbs: {
    compass: "compass.png",
    construction: "construction.png",
    discord: "discord.png",
    home: "home.png",
    latestUpdates: "latest-updates.png",
    production: "production.png",
    military: "military.png",
    transfer: "transfer.png",
    scale: "scale.png",
    trophy: "trophy.png",
    worldMap: "world.png",
  },
}));
vi.mock("@/ui/features/economy/trading", () => ({ MarketModal: () => <article>Market</article> }));
vi.mock("@/ui/features/settlement", () => ({ ProductionModal: () => <article>Production</article> }));
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
const TAB_BAR = 'nav[aria-label="HUD tabs"]';
const ACTION_STRIP = 'nav[aria-label="Structure actions"]';
const tab = (label: string) => container.querySelector<HTMLButtonElement>(`${TAB_BAR} [aria-label="${label}"]`);
const tabLabels = () =>
  [...container.querySelectorAll(`${TAB_BAR} button`)].map((button) => button.getAttribute("aria-label"));
const tabVisibleText = () =>
  [...container.querySelectorAll(`${TAB_BAR} button`)].map((button) => button.textContent?.trim());
const tabImages = () =>
  [...container.querySelectorAll<HTMLImageElement>(`${TAB_BAR} button img`)].map((image) => image.getAttribute("src"));
const actionStrip = () => container.querySelector<HTMLElement>(ACTION_STRIP);
const action = (label: string) => container.querySelector<HTMLButtonElement>(`${ACTION_STRIP} [aria-label="${label}"]`);
const actionLabels = () =>
  [...container.querySelectorAll(`${ACTION_STRIP} button`)].map((button) => button.getAttribute("aria-label"));
const shell = () => container.querySelector<HTMLElement>('[aria-label="Compact HUD"]');
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
    structureEntityId: OWNED_STRUCTURE_ID,
    arrivedArrivalsNumber: 0,
    pendingArrivalsNumber: 0,
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
  expect(tabVisibleText()).toEqual(["", "", "", "", ""]);
  expect(tabImages()).toEqual(["home.png", "world.png", "latest-updates.png", "discord.png", "compass.png"]);
  expect(sheet()).toBeNull();
  expect(shell()?.className).toContain("pointer-events-none");
});

it("docks to the right edge as a column and a vertical rail in landscape, with the sheet filling the column", async () => {
  await act(async () => root.render(<CompactHud key="landscape" lane="landscape" />));
  expect(shell()?.className).toContain("flex-row");
  expect(shell()?.className).toContain("safe-area-inset-top");
  expect(shell()?.className).not.toContain("inset-x-0");
  expect(container.querySelector(TAB_BAR)?.className).toContain("flex-col");
  await tap("Map");
  expect(sheet()?.className).toContain("flex-1");
  expect(sheet()?.className).not.toContain("max-h-[55dvh]");
});

it("offers the structure actions in a row above the tab bar in portrait, only for an owned structure", async () => {
  expect(actionLabels()).toEqual(["Build", "Production", "Military", "Transfer", "Trade"]);
  expect(actionStrip()?.className).toContain("pointer-events-auto");
  expect(shell()?.contains(actionStrip())).toBe(true);
  expect(actionStrip()?.nextElementSibling).toBe(container.querySelector(TAB_BAR));
  expect(tabLabels()).toEqual(["Empire", "Map", "Log", "Chat", "Details"]);
  await act(async () => store.setState({ structureEntityId: OWNED_STRUCTURE_ID + 1 }));
  expect(actionStrip()).toBeNull();
  await act(async () => store.setState({ structureEntityId: OWNED_STRUCTURE_ID, isSpectating: true }));
  expect(actionStrip()).toBeNull();
});

it("docks the structure actions as their own rail on the left edge in landscape", async () => {
  await act(async () => root.render(<CompactHud key="landscape" lane="landscape" />));
  const rail = actionStrip()!;
  expect(rail).not.toBe(container.querySelector(TAB_BAR));
  expect(shell()?.contains(rail)).toBe(false);
  expect(rail.className).toContain("left-0");
  expect(rail.className).toContain("safe-area-inset-top");
  expect(rail.className).toContain("flex-col");
  expect(rail.className).toContain("overflow-y-auto");
  expect(actionLabels()).toEqual(["Build", "Production", "Military", "Transfer", "Trade"]);
  expect(tabLabels()).toEqual(["Empire", "Map", "Log", "Chat", "Details"]);
});

it("opens the build workspace and the market from the structure actions, replacing any open sheet", async () => {
  await tap("Empire");
  await act(async () => action("Build")!.click());
  expect(store.getState().leftNavigationView).toBe(LeftView.ConstructionView);
  expect(action("Build")?.getAttribute("aria-pressed")).toBe("true");
  expect(sheet()).toBeNull();
  await act(async () => action("Build")!.click());
  expect(store.getState().leftNavigationView).toBe(LeftView.None);
  await act(async () => action("Trade")!.click());
  expect(usePopoverStore.getState().openId).toBe("market");
  expect(sheet()).toBeNull();
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
  expect(tabImages()[0]).toBe("trophy.png");
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

it("switches exclusively between workspaces and highlights Production and Trade", async () => {
  const action = (label: string) =>
    document.querySelector<HTMLButtonElement>(`[aria-label="Structure actions"] button[aria-label="${label}"]`)!;
  await act(async () => action("Build").click());
  expect(store.getState().leftNavigationView).toBe(LeftView.ConstructionView);
  await act(async () => action("Production").click());
  expect(store.getState().leftNavigationView).toBe(LeftView.None);
  expect(action("Production").getAttribute("aria-pressed")).toBe("true");
  await act(async () => action("Trade").click());
  expect(action("Production").getAttribute("aria-pressed")).toBe("false");
  expect(action("Trade").getAttribute("aria-pressed")).toBe("true");
  await act(async () => action("Military").click());
  expect(usePopoverStore.getState().openId).toBeNull();
  expect(store.getState().leftNavigationView).toBe(LeftView.MilitaryView);
  await act(async () => action("Transfer").click());
  expect(store.getState().transferPanelSourceId).toBe(OWNED_STRUCTURE_ID);
});
