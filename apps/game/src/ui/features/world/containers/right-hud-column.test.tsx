import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("./hud-chat-window", () => ({
  HudChatWindow: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <div className="mt-auto" data-chat>
      {open && <section aria-label="Chat">Chat pane</section>}
      <button aria-label="Chat strip" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        Chat strip
      </button>
    </div>
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

it("stacks feed, details under it, the chat strip at the bottom; chat keeps the details, the log replaces them", async () => {
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
    expect(details.previousElementSibling?.tagName).toBe("NAV");
    expect(details.className).not.toMatch(/mt-auto|max-h-/);
    expect(details.className).toContain("min-h-0");
    expect(details.className).toContain("overflow-y-auto");
    expect(details.nextElementSibling?.className).toContain("mt-auto");
    await click("Chat strip");
    expect(container.querySelector('[aria-label="Tile details"]')?.textContent).toBe("Realm");
    expect(container.querySelector('[aria-label="Chat"]')?.nextElementSibling?.textContent).toBe("Chat strip");
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
