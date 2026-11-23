// @vitest-environment jsdom
import { act, createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The chat's own parts are tested with the chat; here they stand in as what the page places: the rooms' tabs, the
// players online, and the history with its field.
vi.mock("@/ui/features/social", () => ({
  RealtimeChatTabs: () => (
    <div role="tablist" aria-label="Rooms">
      <button type="button" role="tab">
        Global
      </button>
      <button type="button" role="tab">
        Messages
      </button>
    </div>
  ),
  RealtimeChatOnline: () => <span data-online>2 online</span>,
  RealtimeChatBody: () => <input aria-label="Message Global" />,
  GameChatMap: ({ children }: { children: ReactNode }) => children,
}));

const { ChatPage } = await import("./chat-page");

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const page = (signedIn: boolean, onClose = vi.fn(), onSignIn = vi.fn()) => {
  act(() =>
    root.render(
      <MemoryRouter>
        <ChatPage rooms={[]} signedIn={signedIn} onSignIn={onSignIn} pane={createRef()} onClose={onClose} />
      </MemoryRouter>,
    ),
  );
  const frame = host.querySelector<HTMLElement>('section[aria-label="Chat"]')!;
  return { frame, head: frame.querySelector<HTMLElement>(".ui-frame__head")! };
};

it("shows the Chat header with who is online and places the room tabs cleanly above the history and field", () => {
  const onClose = vi.fn();
  const { frame, head } = page(true, onClose);
  expect(head.querySelector(".ui-panel__title")!.textContent).toBe("Chat");
  expect(head.querySelector(".ui-panel__icon")).not.toBeNull();
  expect(head.querySelector(".ui-panel__cue")!.textContent).toBe("2 online");
  expect([...frame.querySelectorAll('.ui-frame__body [role="tab"]')].map((tab) => tab.textContent)).toEqual([
    "Global",
    "Messages",
  ]);
  expect(frame.querySelector(".ui-frame__body input[aria-label='Message Global']")).not.toBeNull();
  act(() => head.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
  expect(onClose).toHaveBeenCalledOnce();
});

it("names the page Chat in its head while signed out, its body the way into sign-in", () => {
  const onSignIn = vi.fn();
  const { frame, head } = page(false, vi.fn(), onSignIn);
  expect(head.querySelector(".ui-panel__title")!.textContent).toBe("Chat");
  expect(head.querySelector('[role="tab"]')).toBeNull();
  const signIn = [...frame.querySelectorAll("button")].find((button) => button.textContent === "Sign in")!;
  act(() => signIn.click());
  expect(onSignIn).toHaveBeenCalledOnce();
});
