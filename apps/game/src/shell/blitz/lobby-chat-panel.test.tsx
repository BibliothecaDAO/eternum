import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: { user: { realmsId: "0x7" } } as { user: { realmsId: string } } | null }));
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ session: session.current }) }));

import { LobbyChatPanel } from "./lobby-chat-panel";

/** The room socket, as the test drives it: a way to deliver what the room broadcasts. */
class FakeRoom extends EventTarget {
  static last: FakeRoom | null = null;
  constructor(readonly url: string) {
    super();
    FakeRoom.last = this;
  }
  close() {}
  deliver(body: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(body) }));
  }
}

const message = (id: string, playerId: string, content: string, minute: number) => ({
  id,
  sender: { playerId, displayName: playerId === "0x64" ? "Aldric" : undefined },
  zoneId: "slot:blitz-1630",
  content,
  createdAt: new Date(Date.UTC(2026, 9, 8, 16, minute)).toISOString(),
});

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeRoom);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ messages: [message("b", "0x7", "on my way", 2), message("a", "0x64", "gl hf", 1)] }),
    ),
  );
  Element.prototype.scrollTo = () => {};
});

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  vi.unstubAllGlobals();
  session.current = { user: { realmsId: "0x7" } };
});

const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  const client = new QueryClient();
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <LobbyChatPanel slotName="blitz-1630" />
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  unmount = () => act(async () => root.unmount());
  return {
    lines: () => [...container.querySelectorAll("li")].map((line) => line.textContent),
    field: () => container.querySelector("input"),
    text: () => container.textContent,
  };
};

it("reads the history and the room as one list, oldest first, each message once, the reader's own as You", async () => {
  const chat = await mount();
  expect(FakeRoom.last?.url).toContain("/api/chat/rooms/slot%3Ablitz-1630");
  await act(async () =>
    FakeRoom.last!.deliver({ type: "world:message", message: message("b", "0x7", "on my way", 2) }),
  );
  await act(async () => FakeRoom.last!.deliver({ type: "world:message", message: message("c", "0x65", "ready", 3) }));
  expect(chat.lines()).toEqual(["Aldricgl hf", "Youon my way", "Lord 0065ready"]);
});

it("offers no field to write in", async () => {
  const chat = await mount();
  expect(chat.field()).toBeNull();
});

it("asks a signed-out reader to sign in, and opens no room", async () => {
  session.current = null;
  FakeRoom.last = null;
  const chat = await mount();
  expect(chat.text()).toContain("Sign in to read the lobby's chat.");
  expect(FakeRoom.last).toBeNull();
});
