import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  unreadWorldTotal: 2,
  unreadDirectTotal: 1,
  connectionStatus: "connected",
  actions: { setShellOpen: vi.fn() },
}));
vi.mock("@/hooks/store/use-account-store", () => ({ useAccountStore: () => "0x123" }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: () => undefined }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 28 } }));
vi.mock("../../../../../env", () => ({ env: { VITE_PUBLIC_CHAT_URL: "https://chat.test" } }));
vi.mock("@/ui/features/event-feed/important-event-feed", () => ({ ImportantEventFeed: () => <div>Event feed</div> }));
vi.mock("@/ui/features/event-feed/use-unread-events", () => ({ useUnreadEvents: () => 2 }));
vi.mock("@/ui/features/social", () => ({
  useRealtimeChatInitializer: vi.fn(),
  useRealtimeChatSelector: (selector: (state: typeof mocks) => unknown) => selector(mocks),
  RealtimeChatShell: () => <input aria-label="Message" />,
}));
import { HudChatWindow } from "./hud-chat-window";
import { useEventsPanelStore } from "@/ui/features/event-feed/events-panel-store";
it("defaults to Events, badges only the hidden tab, and routes Enter and Esc with input focus", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  useEventsPanelStore.setState({ tab: "events", filter: "all", focusRequest: 0 });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<HudChatWindow />));
    expect(container.textContent).toContain("Event feed");
    expect(container.querySelector('[aria-label="Unread chat messages"]')?.textContent).toBe("3");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(document.activeElement).toBe(container.querySelector("input"));
    expect(container.querySelector('[aria-label="Unread chat messages"]')).toBeNull();
    expect(container.querySelector('[aria-label="Unread events"]')?.textContent).toBe("2");
    await act(async () =>
      container.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    expect(container.textContent).toContain("Event feed");
    expect(container.querySelector("input")).toBeNull();
    await act(async () => useEventsPanelStore.getState().openEvents("mine"));
    expect(useEventsPanelStore.getState()).toMatchObject({ tab: "events", filter: "mine" });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
