// @vitest-environment jsdom
import { act } from "react";
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
vi.mock("@/shell/sign-in/sign-in-route", () => ({ useRequestSignIn: () => fixture.signIn }));
const NAMES = vi.hoisted(() => ({ text: () => "Ada", reading: () => ({ state: "waiting" as const, text: "…" }) }));
vi.mock("@/hooks/use-player-profile", () => ({ resolveChatSenderName: () => "Ada", usePlayerNames: () => NAMES }));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => null }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: {} }));
vi.mock("@bibliothecadao/types", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/types")>()),
  GLOBAL_CHAT_CHANNEL_ID: "global",
}));
vi.mock("@/ui/features/social", () => ({
  RealtimeChatShell: () => <input aria-label="Message" />,
  useRealtimeChatInitializer: () => {},
  useRealtimeChatSelector: (select: (state: unknown) => unknown) =>
    select({
      activeZoneId: "global",
      connectionStatus: fixture.connection,
      joinedZoneIds: ["global"],
      worldZones: { global: fixture.zone },
      unreadWorldTotal: 2,
      unreadDirectTotal: 1,
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
