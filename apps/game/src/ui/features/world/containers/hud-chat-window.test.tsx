import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("@/hooks/store/use-account-store", () => ({ useAccountStore: () => "0x123" }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: () => undefined }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 28 } }));
vi.mock("../../../../../env", () => ({ env: { VITE_PUBLIC_CHAT_URL: "https://chat.test" } }));
vi.mock("@/ui/features/social", () => ({
  useRealtimeChatInitializer: vi.fn(),
  useRealtimeChatSelector: () => "connected",
  RealtimeChatShell: () => <input aria-label="Message" />,
}));
import { HudChatWindow } from "./hud-chat-window";

it("starts open in the HUD and Enter restores and focuses a collapsed chat", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<HudChatWindow />));
    expect(container.querySelector("input")).not.toBeNull();
    await act(async () => container.querySelector("button")!.click());
    expect(container.querySelector("input")).toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(document.activeElement).toBe(container.querySelector("input"));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
