// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// A player in a game whose play is open, on a phone held upright, with no tile chosen. What the panels hold is not this
// test's business, only the tab bar and the Details tab's empty state.
const viewer = vi.hoisted(() => ({ ordersAllowed: true, outOfGame: false }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => viewer.ordersAllowed }));
vi.mock("@/ui/features/world/components/bottom-right-panel", () => ({
  MinimapPanel: () => <svg data-minimap />,
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
// The line for a player whose last realm fell (its reading is out-of-game.test.tsx's); here, only where it shows.
vi.mock("@/ui/features/world/hud/out-of-game", () => ({
  OutOfGameLine: () => (viewer.outOfGame ? <p>You hold no realm. Watch until the end.</p> : null),
}));

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
  viewer.ordersAllowed = true;
  viewer.outOfGame = false;
  view("map");
  act(() => root.render(<CompactHud lane="portrait" />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** The game's view as the address names it: the world map, or the realm's own tiles. */
const view = (scene: "map" | "hex") =>
  act(() => {
    window.history.pushState({}, "", `/g/0xa/3/${scene}`);
    window.dispatchEvent(new Event("urlChanged"));
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

it("names each tab in words under its painting, and paints Chat as chat, not as Discord's logo", () => {
  const tabs = [...host.querySelectorAll('nav[aria-label="HUD tabs"] button')];
  expect(tabs.map((button) => button.textContent)).toEqual(["Empire", "Map", "Log", "Chat", "Details"]);
  expect(tab("Chat").querySelector("img")?.dataset.icon).toBe("chat");
  expect(host.querySelector('[data-icon="discord"]')).toBeNull();
});

it("names a spectator's Standings sheet once, in its head", () => {
  viewer.ordersAllowed = false;
  act(() => useUIStore.setState({}));
  act(() => tab("Standings").click());
  const sheet = host.querySelector('section[aria-label="HUD sheet"]')!;
  expect(sheet.textContent?.match(/Standings/g)).toEqual(["Standings"]);
  expect(sheet.querySelector('section[aria-label="Standings"]')).not.toBeNull();
});

it("tells a player out of the game so in the Empire sheet, and again in Standings once the HUD watches", () => {
  viewer.outOfGame = true;
  act(() => useUIStore.setState({}));
  act(() => tab("Empire").click());
  const sheet = () => host.querySelector('section[aria-label="HUD sheet"]')!;
  expect(sheet().textContent).toContain("You hold no realm. Watch until the end.");
  viewer.ordersAllowed = false;
  act(() => useUIStore.setState({}));
  expect(sheet().querySelector('section[aria-label="Standings"]')).not.toBeNull();
  expect(sheet().textContent).toContain("You hold no realm. Watch until the end.");
});

it("offers the minimap on the world map only: the realm view has no Map tab, and an open Map sheet closes there", () => {
  act(() => tab("Map").click());
  expect(host.querySelector('section[aria-label="HUD sheet"] [data-minimap]')).not.toBeNull();
  view("hex");
  const tabs = [...host.querySelectorAll('nav[aria-label="HUD tabs"] button')].map((button) => button.textContent);
  expect(tabs).toEqual(["Empire", "Log", "Chat", "Details"]);
  expect(host.querySelector('section[aria-label="HUD sheet"]')).toBeNull();
});
