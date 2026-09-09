import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  setCategoryVolume: vi.fn(),
  setMasterVolume: vi.fn(),
  setMuted: vi.fn(),
  setReducedMotion: vi.fn(),
  signOut: vi.fn(),
  disconnect: vi.fn(),
  writeText: vi.fn(),
  spectating: false,
}));
vi.mock("@/audio", () => ({
  AudioCategory: { MUSIC: "music", UI: "ui", COMBAT: "combat" },
  useAudio: () => ({
    ...mocks,
    audioState: { masterVolume: 0.8, categoryVolumes: { music: 0.5, ui: 0.6 }, muted: false },
  }),
}));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ session: { user: { name: "Owner", id: "0x123456789" } } }),
  signOutIdentitySession: mocks.signOut,
}));
vi.mock("@/hooks/store/use-account-store", () => ({ useAccountStore: () => "0x123456789" }));
vi.mock("@/hooks/store/use-world-slices-store", () => ({
  useWorldSlicesStore: () => [{ address: 0x123456789n, name: "Rasch" }],
}));
vi.mock("@/ui/features/social/player/use-in-game-leaderboard", () => ({
  useInGameLeaderboard: () => ({ standingsByAddress: new Map([["0x123456789", { rank: 3, points: 1250 }]]) }),
}));
vi.mock("@/ui/features/social/player/finalized-blitz-leaderboard", () => ({
  normalizeLeaderboardAddress: (address: bigint) => `0x${address.toString(16)}`,
}));
vi.mock("@bibliothecadao/eternum", () => ({ getGuildFromPlayerAddress: () => ({ name: "Bibliotheca" }) }));
vi.mock("@bibliothecadao/react", () => ({ useDojo: () => ({ setup: { components: {} } }) }));
vi.mock("@/utils/spectator-session", () => ({ isExplicitSpectateSession: () => mocks.spectating }));
vi.mock("@starknet-react/core", () => ({ useDisconnect: () => ({ disconnectAsync: mocks.disconnect }) }));
vi.mock("@/hooks/store/use-world-appearance-store", () => ({
  useWorldAppearanceStore: () => ({ reducedMotion: true, setReducedMotion: mocks.setReducedMotion }),
}));
vi.mock("@/ui/debug/renderer-debug-control", () => ({ RendererDebugControl: () => <div>Renderer</div> }));
vi.mock("@/ui/design-system/atoms", () => ({
  RangeInput: ({ title, onChange }: { title: string; onChange: (v: number) => void }) => (
    <button onClick={() => onChange(25)}>{title}</button>
  ),
}));
import { SettingsPanel } from "./settings";
import { getShortcutManager } from "@/utils/shortcuts/centralized-shortcut-manager";

const mount = async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"),
    root = createRoot(container);
  await act(async () => root.render(<SettingsPanel />));
  return { container, root };
};
const findButton = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;

it("shows the profile, wires the controls, lists bound keys and uses gold selected states", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mocks.writeText.mockResolvedValue(undefined) },
  });
  getShortcutManager().registerShortcut({
    id: "toggle-view",
    key: "v",
    description: "Toggle between world and local view",
    action: () => {},
  });
  getShortcutManager().registerShortcut({
    id: "cycle-structures",
    key: "Tab",
    modifiers: { shift: true },
    description: "Cycle through structures",
    action: () => {},
  });
  const { container, root } = await mount();
  const click = async (label: string) => act(async () => findButton(container, label).click());
  try {
    const header = container.querySelector("header")!;
    expect(header.querySelector("img")?.getAttribute("src")).toMatch(/^\/images\/avatars\/0\d\.png$/);
    expect(header.textContent).toContain("Rasch");
    expect(header.textContent).toContain("#3 · 1,250 VP");
    expect(header.textContent).toContain("Bibliotheca");
    expect(container.querySelector("h2")?.textContent).toBe("Video & Graphics");
    expect(container.textContent).toContain("Renderer");
    const keys = [...container.querySelectorAll("dt")].map((node) => node.textContent);
    expect(keys).toEqual(["V", "Shift+Tab", "Enter"]);
    expect(container.textContent).toContain("Open chat");
    await click("Effects");
    expect(mocks.setCategoryVolume.mock.calls).toEqual([
      ["ui", 0.25],
      ["combat", 0.25],
    ]);
    await click("Mute");
    expect(mocks.setMuted).toHaveBeenCalledWith(true);
    await click("Reduced motion");
    expect(mocks.setReducedMotion).toHaveBeenCalledWith(false);
    for (const button of container.querySelectorAll('[aria-pressed="true"]'))
      expect(button.className).toContain("bg-gold text-dark-brown");
    // The RangeInput mock renders bare buttons; every real button overrides the Cinzel default.
    for (const button of container.querySelectorAll("button[class]"))
      expect(button.className).toMatch(/font-(sans|mono)/);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Copy address"]')!.click());
    expect(mocks.writeText).toHaveBeenCalledWith("0x123456789");
    await click("Sign out");
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.disconnect);
    expect(findButton(container, "Leave game")).toBeDefined();
  } finally {
    await act(async () => root.unmount());
    getShortcutManager().clearAllShortcuts();
  }
});

it("shows Spectating with no sign out for an explicit spectator", async () => {
  mocks.spectating = true;
  const { container, root } = await mount();
  try {
    expect(container.querySelector("header")?.textContent).toContain("Spectating");
    expect(findButton(container, "Sign out")).toBeUndefined();
    expect(findButton(container, "Leave game")).toBeDefined();
  } finally {
    await act(async () => root.unmount());
    mocks.spectating = false;
  }
});
