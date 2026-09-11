// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { useRealtimeChatStore } from "../model/store";

vi.mock("../hooks/use-realtime-chat", async () => {
  const { useRealtimeChatStore } = await import("../model/store");
  return {
    useRealtimeChatActions: () => useRealtimeChatStore((state) => state.actions),
    useRealtimeChatSelector: useRealtimeChatStore,
    useRealtimeChatInitializer: () => {},
    useRealtimeConnection: () => ({ connectionStatus: "connected" }),
    useRealtimePresence: () => [],
  };
});
vi.mock("./world-chat/world-chat-panel", () => ({
  WorldChatPanel: ({ zoneId }: { zoneId: string }) => <p data-channel={zoneId}>{zoneId}</p>,
}));
vi.mock("./direct-messages/direct-messages-panel", () => ({ DirectMessagesPanel: () => <p>DM</p> }));
vi.mock("./shared/tab-bar", () => ({ TabBar: () => null }));
vi.mock("./shared/user-dropdown", () => ({ UserDropdown: () => null }));
vi.mock("./shared/realtime-chat-toggle-button", () => ({ RealtimeChatToggleButton: () => null }));

import { RealtimeChatShell } from "./realtime-chat-shell";

afterEach(() => {
  useRealtimeChatStore.getState().actions.resetClient();
  localStorage.clear();
});

it("starts in Global, switches to the current Game, and discards stale game tabs", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  useRealtimeChatStore.setState({
    joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID, "game:7", "game:8"],
    openTabs: [{ id: "world-game:9", type: "world", label: "World", targetId: "game:9", unreadCount: 0 }],
    activeTabId: "world-game:9",
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (gameZoneId: string) =>
    root.render(
      <RealtimeChatShell
        defaultZoneId={GLOBAL_CHAT_CHANNEL_ID}
        gameZoneId={gameZoneId}
        displayMode="embedded"
        autoInitializeClient={false}
      />,
    );
  try {
    await act(async () => render("game:7"));
    const buttons = () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-label="Chat channel"] button'));
    expect(container.querySelector("[data-channel]")?.getAttribute("data-channel")).toBe(GLOBAL_CHAT_CHANNEL_ID);
    expect(buttons()[0].getAttribute("aria-pressed")).toBe("true");
    expect(useRealtimeChatStore.getState().openTabs.map((tab) => tab.targetId)).toEqual([GLOBAL_CHAT_CHANNEL_ID]);
    await act(async () => buttons()[1].click());
    expect(container.querySelector("[data-channel]")?.getAttribute("data-channel")).toBe("game:7");
    await act(async () => buttons()[0].click());
    expect(container.querySelector("[data-channel]")?.getAttribute("data-channel")).toBe(GLOBAL_CHAT_CHANNEL_ID);
    await act(async () => buttons()[1].click());
    await act(async () => render("game:8"));
    expect(container.querySelector("[data-channel]")?.getAttribute("data-channel")).toBe(GLOBAL_CHAT_CHANNEL_ID);
    await act(async () => buttons()[1].click());
    expect(container.querySelector("[data-channel]")?.getAttribute("data-channel")).toBe("game:8");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("keeps Global available without game registration and preserves direct-message tabs", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  useRealtimeChatStore.setState({
    joinedZoneIds: [GLOBAL_CHAT_CHANNEL_ID],
    openTabs: [{ id: "dm-a", type: "dm", label: "Alice", targetId: "a", unreadCount: 1 }],
    activeTabId: "dm-a",
  });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <RealtimeChatShell
          defaultZoneId={GLOBAL_CHAT_CHANNEL_ID}
          gameZoneId="game:7"
          displayMode="embedded"
          autoInitializeClient={false}
        />,
      ),
    );
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-label="Chat channel"] button'));
    expect(buttons[1].disabled).toBe(true);
    await act(async () => buttons[0].click());
    expect(container.querySelector("[data-channel]")?.getAttribute("data-channel")).toBe(GLOBAL_CHAT_CHANNEL_ID);
    expect(useRealtimeChatStore.getState().openTabs.some((tab) => tab.id === "dm-a")).toBe(true);
  } finally {
    await act(async () => root.unmount());
  }
});
