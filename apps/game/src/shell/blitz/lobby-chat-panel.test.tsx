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
  static opened = 0;
  sent: string[] = [];
  constructor(readonly url: string) {
    super();
    FakeRoom.last = this;
    FakeRoom.opened += 1;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.dispatchEvent(new Event("close"));
  }
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

const mount = async (membership = "0x4a1:false:0:false") => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  const client = new QueryClient();
  const render = (current: string) =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <LobbyChatPanel slotName="blitz-1630" membership={current} />
        </QueryClientProvider>,
      ),
    );
  await render(membership);
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  unmount = () => act(async () => root.unmount());
  return {
    rerender: render,
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

it("shows the field only once the room says this reader may write, and sends the message to the slot's room", async () => {
  const chat = await mount();
  expect(chat.field()).toBeNull();
  await act(async () => FakeRoom.last!.deliver({ type: "joined:zone", zoneId: "slot:blitz-1630", canWrite: false }));
  expect(chat.field()).toBeNull();
  await act(async () => FakeRoom.last!.deliver({ type: "joined:zone", zoneId: "slot:blitz-1630", canWrite: true }));
  const field = chat.field()!;
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
  // The room refusing a writer whose registration is gone takes the field away; nothing is elevated here.
  await act(async () => FakeRoom.last!.deliver({ type: "error", code: "registration_required" }));
  expect(chat.field()).toBeNull();
});

it("opens the room again when the wallet's registration changes, since the room decides its writers at the open", async () => {
  FakeRoom.opened = 0;
  const chat = await mount("0x4a1:false:0:false");
  await act(async () => FakeRoom.last!.deliver({ type: "joined:zone", zoneId: "slot:blitz-1630", canWrite: false }));
  expect(FakeRoom.opened).toBe(1);
  await chat.rerender("0x4a1:true:500:false");
  expect(FakeRoom.opened).toBe(2);
  // The room that was replaced closing is no failure of the chat.
  expect(chat.text()).not.toContain("did not answer");
  await act(async () => FakeRoom.last!.deliver({ type: "joined:zone", zoneId: "slot:blitz-1630", canWrite: true }));
  expect(chat.field()).not.toBeNull();
});

it("asks a signed-out reader to sign in, and opens no room", async () => {
  session.current = null;
  FakeRoom.last = null;
  const chat = await mount();
  expect(chat.text()).toContain("Sign in to read the lobby's chat.");
  expect(FakeRoom.last).toBeNull();
});
