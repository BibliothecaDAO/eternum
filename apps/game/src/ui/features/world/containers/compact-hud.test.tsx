// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// A player in a game whose play is open, on a phone held upright, with no tile chosen. What the panels hold is not this
// test's business, only the tab bar and the Details tab's empty state.
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true }));
vi.mock("@/ui/features/world/components/bottom-right-panel", () => ({
  MinimapPanel: () => null,
  useSelectedTileDetails: () => null,
}));
vi.mock("@/ui/features/event-feed/quick-feed", () => ({
  FeedToasts: () => null,
  UnreadFeedBadge: () => null,
  useEventsFeed: () => ({ stories: [] }),
  useUnreadFeedCount: () => 0,
}));
vi.mock("@/ui/features/event-feed/event-log-panel", () => ({ EventLogPanel: () => null }));
vi.mock("@/ui/features/social", () => ({ useRealtimeChatSelector: () => 0 }));
vi.mock("./hud-chat-window", () => ({ HudChatWindow: () => null }));
vi.mock("./left-facets/empire-cockpit", () => ({ EmpireCockpit: () => null }));
vi.mock("./left-facets/structure-list-column", () => ({ StructureListColumn: () => null }));
vi.mock("./left-facets/use-structure-actions", () => ({ useStructureActions: () => null }));
vi.mock("./spectator-standings", () => ({ SpectatorStandingsBody: () => null }));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { CompactHud } from "./compact-hud";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  // The game has loaded: the blank overlay that covers the boot is gone.
  useUIStore.setState({ showBlankOverlay: false });
  act(() => root.render(<CompactHud lane="portrait" />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const tab = (name: string) =>
  host.querySelector<HTMLButtonElement>(`nav[aria-label="HUD tabs"] [aria-label="${name}"]`)!;

it("draws the Details tab's empty state with the explore painting, not a broken image named after it", () => {
  act(() => tab("Details").click());
  const sheet = host.querySelector('section[aria-label="HUD sheet"]')!;
  expect(sheet.textContent).toContain("Tap a tile on the map to inspect");
  const painting = [...sheet.querySelectorAll("img")].find((img) =>
    img.parentElement?.textContent?.includes("Tap a tile"),
  )!;
  expect(painting.dataset.icon).toBe("explore");
  expect(painting.getAttribute("src")).toMatch(/^\/icons\/facets\/\d+\/explore\.webp$/);
  // Every painting the sheet draws loads from an address, never from a meaning's bare name.
  expect([...sheet.querySelectorAll("img")].map((img) => img.getAttribute("src")?.startsWith("/"))).not.toContain(
    false,
  );
});
