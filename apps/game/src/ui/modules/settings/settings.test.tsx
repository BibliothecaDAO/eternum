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
vi.mock("@starknet-react/core", () => ({ useDisconnect: () => ({ disconnectAsync: mocks.disconnect }) }));
vi.mock("@/hooks/store/use-world-appearance-store", () => ({
  useWorldAppearanceStore: () => ({ reducedMotion: true, setReducedMotion: mocks.setReducedMotion }),
}));
vi.mock("@/ui/design-system/atoms", () => ({
  RangeInput: ({ title, onChange }: { title: string; onChange: (v: number) => void }) => (
    <button onClick={() => onChange(25)}>{title}</button>
  ),
}));
import { SettingsPanel } from "./settings";
it("wires the consolidated controls and uses gold selected states", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mocks.writeText.mockResolvedValue(undefined) },
  });
  const container = document.createElement("div"),
    root = createRoot(container);
  const click = async (label: string) =>
    act(async () => [...container.querySelectorAll("button")].find((b) => b.textContent === label)!.click());
  try {
    await act(async () => root.render(<SettingsPanel />));
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
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Copy address"]')!.click());
    expect(mocks.writeText).toHaveBeenCalledWith("0x123456789");
    await click("Sign out");
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.disconnect);
  } finally {
    await act(async () => root.unmount());
  }
});
