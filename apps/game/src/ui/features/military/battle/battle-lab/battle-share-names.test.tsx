// @vitest-environment jsdom
// The live battle's Share text, from the reviewer's case (review-player-name-one-rule-2): the attacker is already named,
// the defender's identity is held while the real BattleLab settles on stable combat facts, then only the defender's
// answer lands. The text Share sends must carry it: a name, "—" for a failed ask, the unclaimed name for none.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const held = vi.hoisted(() => ({
  answer: undefined as undefined | ((name: string | null, fail: boolean) => void),
  live: null as any,
  store: {},
  account: { address: "0x5eedaa00" },
}));
vi.mock("@realms-world/identity", async (original) => ({
  ...(await original<typeof import("@realms-world/identity")>()),
  fetchIdentityProfiles: (_origin: string, accounts: string[]) => {
    if (accounts.every((a) => BigInt(a) === BigInt(held.account.address)))
      return Promise.resolve(Object.fromEntries(accounts.map((a) => [a, { name: "Attacker", portrait: null }])));
    return new Promise((resolve, reject) => {
      held.answer = (name, fail) =>
        fail
          ? reject(new Error("identity 503"))
          : resolve(Object.fromEntries(accounts.map((a) => [a, { name, portrait: null }])));
    });
  },
}));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: held.store, systemCalls: {} }, account: { account: held.account } }),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ ui: { showAttackTypeSelector: false } }),
}));
vi.mock("@bibliothecadao/eternum", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum")>()),
  getGuildFromPlayerAddress: () => null,
  configManager: { getCombatConfig: () => ({ stamina_attack_req: 1 }), rollsCombatDice: () => false },
  CombatSimulator: class {
    simulateBattleRange() {
      const roll = { attackerDamage: 1, defenderDamage: 1, attackerRefundMultiplier: 1, defenderRefundMultiplier: 1 };
      return { worst: roll, best: roll };
    }
    calculateNewStaminaAttacker() {
      return 90;
    }
    calculateNewStaminaDefender() {
      return 90;
    }
  },
}));
vi.mock("./use-battle-lab-live-data", () => ({ useBattleLabLiveData: () => held.live }));
vi.mock("./army-column", () => ({ ArmyColumn: () => null }));
vi.mock("./biome-environment-bar", () => ({ BiomeEnvironmentBar: () => null }));
vi.mock("./combat-parameters-panel", () => ({ CombatParametersPanel: () => null }));
vi.mock("./outcome-banner", () => ({ OutcomeBanner: () => null }));
vi.mock("./outcome-strip", () => ({ OutcomeStrip: () => null }));
vi.mock("../raid-container", () => ({ RaidContainer: () => null }));
vi.mock("@/ui/design-system/kit/hud-elements", () => ({
  HudWindow: ({ children }: any) => <section>{children}</section>,
  HudCheck: () => null,
  HudNotice: () => null,
  HudTabs: () => null,
  HudButton: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
import { BattleLab } from "./battle-lab";
import { getPlayerDisplayName } from "@/services/identity/player-profiles";
it.each([
  ["0x5eedba01", "Maelis", false, "Maelis"],
  ["0x5eedba02", null, true, "—"],
  ["0x5eedba03", null, false, "Lord ba03"],
] as const)(
  "updates a live battle's shared text when only defender identity answers %s",
  async (owner, name, failed, expected) => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    getPlayerDisplayName(held.account.address);
    await vi.waitFor(() => expect(getPlayerDisplayName(held.account.address)).toBe("Attacker"));
    const army = { stamina: 100, troopCount: 100, troopType: 1, tier: 1, battle_cooldown_end: 0, relics: [] };
    held.live = {
      snapshot: {
        biome: "Grassland",
        attackerType: "army",
        attackerEntityId: 7,
        guards: [],
        armyAttacker: army,
        defender: army,
        totalDefenders: 100,
        hasTarget: true,
        defenderAlt: false,
      },
      target: { id: 8, addressOwner: BigInt(owner), hex: { x: 1, y: 0 }, targetType: "Army" },
      targetResources: [],
      attackerRelicEffects: [],
      targetRelicEffects: [],
      isLoading: false,
    };
    const host = document.createElement("div"),
      root = createRoot(host);
    const opened = vi.spyOn(window, "open").mockReturnValue(null);
    const share = () => {
      const button = [...host.querySelectorAll("button")].find((b) => b.textContent === "Share your Battle")!;
      expect(button).toBeDefined();
      act(() => button.click());
      return new URL(String(opened.mock.lastCall![0])).searchParams.get("text")!;
    };
    try {
      await act(async () => root.render(<BattleLab mode="live" />));
      await vi.waitFor(() => expect(held.answer).toBeDefined());
      expect(share()).toContain("…");
      await act(async () => {
        held.answer!(name, failed);
        await new Promise((r) => setTimeout(r, 10));
      });
      expect(getPlayerDisplayName(owner)).toBe(expected);
      const text = share();
      console.log("BATTLE_SHARE_AFTER_NAME", JSON.stringify({ direct: getPlayerDisplayName(owner), text }));
      expect(text).toContain(expected);
      expect(text).not.toContain("…");
    } finally {
      await act(async () => root.unmount());
      opened.mockRestore();
      held.answer = undefined;
    }
  },
);
