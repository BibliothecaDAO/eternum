import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: { user: { realmsId: "0x7" } } as { user: { realmsId: string } } | null }));
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ session: session.current }) }));

import { LobbyChatPanel } from "./lobby-chat-panel";

/** The room socket, as the test drives it: what the lobby sent, and a way to deliver what the room broadcasts. */
class FakeRoom extends EventTarget {
  static last: FakeRoom | null = null;
  sent: string[] = [];
  constructor(readonly url: string) {
    super();
    FakeRoom.last = this;
  }
  send(data: string) {
    this.sent.push(data);
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

const mount = async (seated: boolean) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  const client = new QueryClient();
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <LobbyChatPanel slotName="blitz-1630" seated={seated} />
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  unmount = () => act(async () => root.unmount());
  return {
    lines: () => [...container.querySelectorAll("li")].map((line) => line.textContent),
    field: () => container.querySelector("input")!,
    text: () => container.textContent,
  };
};

it("reads the history and the room as one list, oldest first, each message once, the reader's own as You", async () => {
  const chat = await mount(false);
  expect(FakeRoom.last?.url).toContain("/api/chat/rooms/slot%3Ablitz-1630");
  await act(async () =>
    FakeRoom.last!.deliver({ type: "world:message", message: message("b", "0x7", "on my way", 2) }),
  );
  await act(async () => FakeRoom.last!.deliver({ type: "world:message", message: message("c", "0x65", "ready", 3) }));
  expect(chat.lines()).toEqual(["Aldricgl hf", "Youon my way", "Lord 0065ready"]);
});

it("closes the field to a reader without a seat, and sends a seated player's message to the slot's room", async () => {
  const unseated = await mount(false);
  expect(unseated.field().disabled).toBe(true);
  expect(unseated.field().placeholder).toBe("Take a seat to write");
  await unmount!();

  const seated = await mount(true);
  const field = seated.field();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "hold the east");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => field.form!.requestSubmit());
  expect(JSON.parse(FakeRoom.last!.sent[0])).toMatchObject({
    type: "world:publish",
    zoneId: "slot:blitz-1630",
    payload: { zoneId: "slot:blitz-1630", content: "hold the east" },
  });
});

it("asks a signed-out reader to sign in, and opens no room", async () => {
  session.current = null;
  FakeRoom.last = null;
  const chat = await mount(false);
  expect(chat.text()).toContain("Sign in to read the lobby's chat.");
  expect(FakeRoom.last).toBeNull();
});
