// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  status: "signed-in",
  signIn: vi.fn(),
  setOpen: vi.fn(),
  loadHistory: vi.fn(),
}));
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: fixture.status }) }));
vi.mock("@/shell/sign-in/sign-in-route", () => ({ useRequestSignIn: () => fixture.signIn }));
vi.mock("@/hooks/use-player-profile", () => ({ resolveChatSenderName: () => "Ada" }));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => null }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: {} }));
vi.mock("@bibliothecadao/types", () => ({ GLOBAL_CHAT_CHANNEL_ID: "global" }));
vi.mock("@/ui/features/social", () => ({
  RealtimeChatShell: () => <input aria-label="Message" />,
  useRealtimeChatInitializer: () => {},
  useRealtimeChatSelector: (select: (state: unknown) => unknown) =>
    select({
      activeZoneId: "global",
      connectionStatus: "connected",
      joinedZoneIds: ["global"],
      worldZones: { global: { messages: [{ sender: { playerId: "1", displayName: "Ada" }, content: "Hello" }] } },
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
  expect(strip.classList.contains("ui-button")).toBe(true);
  act(() => strip.click());
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  draw(true);
  expect(host.querySelector('[aria-label="Chat"]')?.classList.contains("ui-panel")).toBe(true);
  expect(document.activeElement).toBe(host.querySelector('[aria-label="Message"]'));
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

it("keeps a signed-out player's sign-in action and disables the strip while identity loads", () => {
  fixture.status = "signed-out";
  draw(false);
  const strip = host.querySelector<HTMLButtonElement>('button[aria-label="Chat strip"]')!;
  expect(strip.textContent).toContain("Sign in to chat");
  act(() => strip.click());
  expect(fixture.signIn).toHaveBeenCalledTimes(1);
  expect(onOpenChange).not.toHaveBeenCalled();
  fixture.status = "loading";
  draw(false);
  expect(strip.disabled).toBe(true);
});
