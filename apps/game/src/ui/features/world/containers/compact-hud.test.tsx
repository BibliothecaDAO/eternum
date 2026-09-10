import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { StoreApi, UseBoundStore } from "zustand";

interface TestUiState {
  showBlankOverlay: boolean;
  isSpectating: boolean;
  selectedHex: { col: number; row: number } | null;
  selectedBuildingHex: { outerCol: number; outerRow: number; innerCol: number; innerRow: number } | null;
}

const mocks = vi.hoisted(() => ({ isMapView: true, rows: [] as { at: number }[] }));
vi.mock("@/hooks/store/use-ui-store", async () => {
  const { create } = await import("zustand");
  return {
    useUIStore: create<TestUiState>(() => ({
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
vi.mock("@bibliothecadao/react", () => ({ useQuery: () => ({ isMapView: mocks.isMapView }) }));
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
vi.mock("@/ui/features/world/components/bottom-right-panel", () => ({
  MinimapPanel: () => <article>Minimap</article>,
  MapTilePanel: () => <article>Map tile</article>,
  LocalTilePanel: () => <article>Local tile</article>,
}));
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

const store = useUIStore as unknown as UseBoundStore<StoreApi<TestUiState>>;

let container: HTMLDivElement;
let root: Root;
const tab = (label: string) => container.querySelector<HTMLButtonElement>(`nav [aria-label="${label}"]`);
const tabLabels = () =>
  [...container.querySelectorAll("nav button")].map((button) => button.getAttribute("aria-label"));
const sheet = () => container.querySelector('[aria-label="HUD sheet"]');
const tap = (label: string) => act(async () => tab(label)!.click());

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.isMapView = true;
  mocks.rows = [];
  store.setState({ showBlankOverlay: false, isSpectating: false, selectedHex: null, selectedBuildingHex: null });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<CompactHud lane="portrait" />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("renders the tab bar with no sheet and no Details tab until something is selected", () => {
  expect(tabLabels()).toEqual(["Empire", "Map", "Log", "Chat"]);
  expect(sheet()).toBeNull();
  expect(container.querySelector('[aria-label="Compact HUD"]')?.className).toContain("pointer-events-none");
});

it("docks to the right edge as a column and a vertical rail in landscape, with the sheet filling the column", async () => {
  await act(async () => root.render(<CompactHud key="landscape" lane="landscape" />));
  const shell = container.querySelector('[aria-label="Compact HUD"]')!;
  expect(shell.className).toContain("flex-row");
  expect(shell.className).toContain("top-11");
  expect(shell.className).not.toContain("inset-x-0");
  expect(container.querySelector("nav")?.className).toContain("flex-col");
  await tap("Map");
  expect(sheet()?.className).toContain("flex-1");
  expect(sheet()?.className).not.toContain("max-h-[55dvh]");
});

it("opens one sheet at a time and closes it when the active tab is tapped again", async () => {
  await tap("Map");
  expect(tab("Map")?.getAttribute("aria-expanded")).toBe("true");
  expect(sheet()?.textContent).toBe("Minimap");
  expect(sheet()?.className).toContain("touch-pan-y");
  await tap("Empire");
  expect(sheet()?.textContent).toBe("StructuresCockpit");
  expect(tab("Map")?.getAttribute("aria-expanded")).toBe("false");
  await tap("Empire");
  expect(sheet()).toBeNull();
});

it("hosts the standings for a spectator", async () => {
  await act(async () => store.setState({ isSpectating: true }));
  expect(tabLabels()[0]).toBe("Standings");
  await tap("Standings");
  expect(sheet()?.textContent).toBe("Standings");
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

it("shows and auto-opens Details on a new selection, and drops it when the selection clears", async () => {
  await act(async () => store.setState({ selectedHex: { col: 4, row: 7 } }));
  expect(tabLabels()).toContain("Details");
  expect(sheet()?.textContent).toBe("Map tile");
  await tap("Map");
  await act(async () => store.setState({ selectedHex: { col: 5, row: 7 } }));
  expect(sheet()?.textContent).toBe("Map tile");
  await act(async () => store.setState({ selectedHex: null }));
  expect(tabLabels()).not.toContain("Details");
  expect(sheet()).toBeNull();
});

it("follows the selected building in local view", async () => {
  mocks.isMapView = false;
  await act(async () =>
    store.setState({ selectedBuildingHex: { outerCol: 1, outerRow: 1, innerCol: 2, innerRow: 3 } }),
  );
  expect(sheet()?.textContent).toBe("Local tile");
});
