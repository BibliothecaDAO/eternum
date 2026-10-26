// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("./world-chat/world-chat-panel", () => ({ WorldChatPanel: () => null }));
vi.mock("./direct-messages/direct-messages-panel", () => ({ DirectMessagesPanel: () => null }));

import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";
import { RealtimeChatShell } from "./realtime-chat-shell";

it("stands Global, Game and a new DM in one row of tabs, with no World tab beside them", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <RealtimeChatShell
        defaultZoneId={GLOBAL_CHAT_CHANNEL_ID}
        gameZoneId="game-1"
        displayMode="embedded"
        autoInitializeClient={false}
        showInlineToggle={false}
      />,
    ),
  );
  const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === text);
  expect(button("Global")?.getAttribute("aria-pressed")).toBe("true");
  expect(button("Game")?.getAttribute("aria-pressed")).toBe("false");
  expect(button("World")).toBeUndefined();
  // One row: the zones and the new DM share their parent.
  expect(button("Global")?.parentElement).toBe(button("+ DM")?.parentElement);
  act(() => root.unmount());
});
