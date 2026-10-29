// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const HELLO = { sender: { playerId: "1", displayName: "Ada" }, content: "Hello" };
const fixture = vi.hoisted(() => ({
  status: "signed-in",
  signIn: vi.fn(),
  setOpen: vi.fn(),
  loadHistory: vi.fn(),
  connection: "connected",
  zone: {} as Record<string, unknown>,
}));
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: fixture.status }) }));
vi.mock("@/shell/sign-in/connect", () => ({ useRequestSignIn: () => fixture.signIn }));
const NAMES = vi.hoisted(() => ({ text: () => "Ada", reading: () => ({ state: "waiting" as const, text: "…" }) }));
vi.mock("@/hooks/use-player-profile", () => ({ resolveChatSenderName: () => "Ada", usePlayerNames: () => NAMES }));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => null }));
// No game here: a place reads as its message has it (chat-places.test.tsx reads places in a game).
vi.mock("@/ui/features/social/realtime-chat/ui/shared/use-chat-map", () => ({
  usePlaceReader: () => (place: { name: string; icon: string }) => ({ ...place, open: null, elsewhere: true }),
}));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: {} }));
vi.mock("@bibliothecadao/types", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/types")>()),
  GLOBAL_CHAT_CHANNEL_ID: "global",
}));
vi.mock("@/ui/features/social", () => ({
  RealtimeChatShell: () => <input aria-label="Message" />,
  GameChatMap: ({ children }: { children: ReactNode }) => children,
  useRealtimeChatInitializer: () => {},
  useRealtimeChatSelector: (select: (state: unknown) => unknown) =>
    select({
      activeZoneId: "global",
      connectionStatus: fixture.connection,
      joinedZoneIds: ["global"],
      worldZones: { global: fixture.zone },
      unreadWorldTotal: 2,
      blockList: { blocked: [], version: 0 },
      // One conversation the server counts one unread in.
      identity: { playerId: "0x7" },
      dmThreads: { "0x7|0xa": { thread: { participants: ["0x7", "0xa"], unreadCounts: { "0x7": 1 } } } },
      actions: { loadWorldHistory: fixture.loadHistory, setShellOpen: fixture.setOpen },
    }),
}));

import { HudChatWindow } from "./hud-chat-window";

let host: HTMLDivElement;
let root: Root;
const onOpenChange = vi.fn();
const draw = (open: boolean) => act(() => root.render(<HudChatWindow open={open} onOpenChange={onOpenChange} />));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  fixture.status = "signed-in";
  fixture.connection = "connected";
  fixture.zone = { messages: [HELLO] };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("keeps chat's message, unread count, open action, input focus and Escape on the shared controls", () => {
  draw(false);
  const strip = host.querySelector<HTMLButtonElement>('button[aria-label="Chat strip"]')!;
  expect(strip.textContent).toContain("Ada: Hello");
  expect(host.querySelector('[aria-label="Unread chat messages 3"]')).not.toBeNull();
  // On the sheet's strip, the surface that reads over any ground the map shows under it.
  expect(strip.classList.contains("ui-pill")).toBe(true);
  act(() => strip.click());
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  draw(true);
  expect(host.querySelector('[aria-label="Chat"]')?.classList.contains("ui-panel")).toBe(true);
  expect(document.activeElement).toBe(host.querySelector('[aria-label="Message"]'));
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

it("leaves Escape to the message field while its list of players is open, so chat stays open", () => {
  draw(true);
  const field = host.querySelector<HTMLInputElement>('[aria-label="Message"]')!;
  field.setAttribute("aria-expanded", "true");
  act(() => field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(onOpenChange).not.toHaveBeenCalled();
  field.setAttribute("aria-expanded", "false");
  act(() => field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

// Playtest 29 October 2026 (B3): a place shared, the map dragged off it, then the place opened from the message.
it("stays open while the map is dragged, and goes away on a click on the map", () => {
  draw(true);
  const map = document.createElement("canvas");
  document.body.append(map);
  const pointer = (type: string, target: EventTarget, x: number, y: number) =>
    act(() => {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
    });
  // A drag: the press goes down on the map and travels well past a click's slop.
  pointer("pointerdown", map, 400, 300);
  pointer("pointermove", map, 460, 340);
  pointer("pointerup", map, 660, 480);
  expect(onOpenChange).not.toHaveBeenCalled();
  // A drag that comes back to where it went down is still a drag.
  pointer("pointerdown", map, 400, 300);
  pointer("pointermove", map, 500, 300);
  pointer("pointerup", map, 402, 301);
  expect(onOpenChange).not.toHaveBeenCalled();
  // A click: the press holds within a few pixels, as the map takes it to pick what is under it.
  pointer("pointerdown", map, 400, 300);
  pointer("pointermove", map, 403, 302);
  pointer("pointerup", map, 404, 302);
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  map.remove();
});

it("keeps a signed-out player's sign-in action, and the strip cannot be pressed while identity loads", () => {
  fixture.status = "signed-out";
  draw(false);
  const strip = host.querySelector<HTMLButtonElement>('button[aria-label="Chat strip"]')!;
  expect(strip.textContent).toContain("Sign in to chat");
  act(() => strip.click());
  expect(fixture.signIn).toHaveBeenCalledTimes(1);
  expect(onOpenChange).not.toHaveBeenCalled();
  fixture.status = "loading";
  draw(false);
  expect(host.querySelector('button[aria-label="Chat strip"]')).toBeNull();
  expect(host.querySelector('[aria-label="Chat strip"]')?.textContent).toContain("Sign in to chat");
});

const stripLine = () => host.querySelector('[aria-label="Chat strip"] .truncate')?.textContent;

it("says chat is loading until the room's history answers, never an empty room it has not read", () => {
  fixture.zone = { messages: [], isFetchingHistory: true };
  draw(false);
  expect(stripLine()).toBe("Loading chat…");
  fixture.connection = "connecting";
  fixture.zone = { messages: [] };
  draw(false);
  expect(stripLine()).toBe("Loading chat…");
});

it("says the room is empty only once its history answered with no message", () => {
  fixture.zone = { messages: [], lastFetchedCursor: null, isFetchingHistory: false };
  draw(false);
  expect(stripLine()).toBe("No messages yet");
});

it("says chat is unavailable when the history read or the connection failed, never that the room is empty", () => {
  fixture.zone = { messages: [], isFetchingHistory: false, historyError: "Chat history is unavailable. Try again." };
  draw(false);
  expect(stripLine()).toBe("Chat unavailable");
  fixture.connection = "error";
  fixture.zone = { messages: [] };
  draw(false);
  expect(stripLine()).toBe("Chat unavailable");
});

it("shows a message that arrived live even while the history read is still out", () => {
  fixture.zone = { messages: [HELLO], isFetchingHistory: true };
  draw(false);
  expect(stripLine()).toBe("Ada: Hello");
});
