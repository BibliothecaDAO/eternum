import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  address: "0x123" as string | undefined,
  unreadWorldTotal: 2,
  unreadDirectTotal: 1,
  worldZones: {
    "game:28": { messages: [{ id: "m1", content: "gg wp", sender: { playerId: "0x9", displayName: "Rasch" } }] },
  } as Record<string, { messages: Array<{ id: string; content: string; sender: { playerId: string; displayName?: string } }> }>,
  connectionStatus: "connected",
  actions: { setShellOpen: vi.fn(), loadWorldHistory: vi.fn() },
}));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: { account?: { address: string } }) => unknown) =>
    select({ account: mocks.address ? { address: mocks.address } : undefined }),
}));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 28 } }));
vi.mock("../../../../../env", () => ({ env: { VITE_PUBLIC_CHAT_URL: "https://chat.test" } }));
vi.mock("@/ui/features/social", () => ({
  useRealtimeChatInitializer: vi.fn(),
  useRealtimeChatSelector: (selector: (state: typeof mocks) => unknown) => selector(mocks),
  RealtimeChatShell: () => <input aria-label="Message" />,
}));
import { HudChatWindow } from "./hud-chat-window";
import { useState } from "react";

const Host = () => {
  const [open, setOpen] = useState(false);
  return <HudChatWindow open={open} onOpenChange={setOpen} />;
};

const mount = () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  return { container, root };
};

it("shows the last message with the unread count, opens on Enter and closes on Escape or a map click", async () => {
  const { container, root } = mount();
  try {
    await act(async () => root.render(<Host />));
    const strip = container.querySelector<HTMLButtonElement>('[aria-label="Chat strip"]')!;
    expect(strip.textContent).toBe("Rasch: gg wp3");
    expect(mocks.actions.loadWorldHistory).toHaveBeenCalledWith({ zoneId: "game:28", limit: 10 });
    expect(container.querySelector('[aria-label="Unread chat messages"]')?.textContent).toBe("3");
    expect(container.querySelector("input")).toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(document.activeElement).toBe(container.querySelector("input"));
    expect(mocks.actions.setShellOpen).toHaveBeenLastCalledWith(true);
    expect(container.querySelector('[aria-label="Unread chat messages"]')).toBeNull();
    await act(async () =>
      container.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    expect(container.querySelector("input")).toBeNull();
    await act(async () => strip.click());
    expect(container.querySelector("input")).not.toBeNull();
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    await act(async () => canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    canvas.remove();
    expect(container.querySelector("input")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("asks a signed-out viewer to sign in and ignores Enter", async () => {
  mocks.address = undefined;
  const { container, root } = mount();
  try {
    await act(async () => root.render(<Host />));
    const strip = container.querySelector<HTMLButtonElement>('[aria-label="Chat strip"]')!;
    expect(strip.textContent).toBe("Sign in to chat");
    expect(strip.disabled).toBe(true);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(container.querySelector("input")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    mocks.address = "0x123";
  }
});
