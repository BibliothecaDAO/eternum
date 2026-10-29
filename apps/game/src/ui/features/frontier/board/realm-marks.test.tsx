import { REALM_SKIN_MODELS, realmSkinIcon } from "@/three/structures/realm-skins";
// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const profiles: Record<string, { name: string | null; portrait: string | null }> = {
  "0xabc": { name: "Aldric", portrait: null },
  "0x1234": { name: null, portrait: null },
};
// Identity has answered for both: the one rule names them.
vi.mock("@/hooks/use-player-profile", async () => {
  const { readKnownPlayerName } = await import("@/services/identity/player-profiles");
  return {
    usePlayerProfile: (account: string) => profiles[account],
    usePlayerName: (account: string) => readKnownPlayerName(account, profiles[account].name),
    playerAvatarUrl: (account: string) => `/portraits/${account}.webp`,
  };
});

import { LordName, OrderMark, RealmBadge } from "./realm-marks";

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

  it("shows a realm's rank by its castle, with its depth's painting as a badge, no numeral, and none before the first", () => {
    const deep = render(<RealmBadge level={1} depth={2} />);
    expect(deep.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("City · Ethereal II");
    expect(deep.querySelector('[data-icon="depth-2"]')).not.toBeNull();
    expect(deep.textContent).toBe("");
    const home = render(<RealmBadge level={0} depth={0} />);
    expect(home.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Settlement");
    expect(home.textContent).toBe("");
  });

  it("names the Order its painting shows", () => {
    const host = render(<OrderMark order={1} />);
    expect(host.querySelector("img")?.getAttribute("alt")).toBeTruthy();
  });
});

it.each(REALM_SKIN_MODELS)("shows $skin at level $level on the season list", ({ skin, level }) => {
  const badge = render(<RealmBadge level={level} depth={0} skin={skin} />);
  expect(badge.querySelector(`img[src$="/${realmSkinIcon(skin)}.webp"]`)).not.toBeNull();
});
