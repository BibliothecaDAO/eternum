import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("./hud-chat-window", () => ({
  HudChatWindow: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <button aria-label="Chat strip" aria-expanded={open} onClick={() => onOpenChange(!open)}>
      Chat strip
    </button>
  ),
}));
vi.mock("@/ui/features/event-feed/quick-feed", () => ({
  QuickFeed: ({ logOpen, onLogToggle }: { logOpen: boolean; onLogToggle: () => void }) => (
    <nav>
      <button aria-label="Log" aria-expanded={logOpen} onClick={onLogToggle}>
        Log
      </button>
    </nav>
  ),
}));
import { RightHudColumn } from "./right-hud-column";

it("stacks feed, bottom-anchored details, then the chat strip, and collapses details while chat or log is open", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  const click = (label: string) =>
    act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  try {
    await act(async () =>
      root.render(
        <RightHudColumn>
          <article>Realm</article>
        </RightHudColumn>,
      ),
    );
    const aside = container.querySelector("aside")!;
    expect(aside.className).toContain("top-[60px]");
    expect(aside.firstElementChild?.tagName).toBe("NAV");
    const details = container.querySelector('[aria-label="Tile details"]')!;
    expect(details.className).toContain("mt-auto");
    expect(details.nextElementSibling?.textContent).toBe("Chat strip");
    await click("Chat strip");
    expect(container.querySelector('[aria-label="Tile details"]')).toBeNull();
    expect(aside.className).toContain("z-[130]");
    await click("Log");
    expect(container.querySelector('[aria-label="Log"]')?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector('[aria-label="Chat strip"]')?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[aria-label="Tile details"]')).toBeNull();
    await click("Log");
    expect(container.querySelector('[aria-label="Tile details"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});
