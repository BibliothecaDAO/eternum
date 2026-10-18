// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const profiles: Record<string, { name: string | null; portrait: string | null }> = {
  "0xabc": { name: "Aldric", portrait: null },
  "0x1234": { name: null, portrait: null },
};
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayerProfile: (account: string) => profiles[account],
  playerAvatarUrl: (account: string) => `/portraits/${account}.webp`,
}));

import { LordName, OrderMark } from "./realm-marks";

const render = (node: ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return host;
};

describe("a lord and a realm's Order on the HUD", () => {
  it("names a lord by the claimed name, with the portrait where there is room", () => {
    const host = render(<LordName account="0xabc" portrait />);
    expect(host.textContent).toBe("Aldric");
    expect(host.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Aldric");
    expect(host.querySelector("img")?.getAttribute("src")).toBe("/portraits/0xabc.webp");
  });

  it("names an unclaimed lord by the account's last four, muted, and the player's own row You", () => {
    const unclaimed = render(<LordName account="0x1234" />);
    expect(unclaimed.textContent).toMatch(/1234/);
    expect(unclaimed.querySelector(".text-hud-muted")).not.toBeNull();
    expect(unclaimed.querySelector("img")).toBeNull();
    expect(render(<LordName account="0xabc" you />).textContent).toBe("You");
  });

  it("names the Order its painting shows", () => {
    const host = render(<OrderMark order={1} />);
    expect(host.querySelector("img")?.getAttribute("alt")).toBeTruthy();
  });
});
