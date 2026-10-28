// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/unit-command-audio", () => ({ playUnitCommandSound: () => {} }));
vi.mock("@/hooks/use-player-profile", () => ({ usePlayerDisplayName: () => "a player" }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 360,
  useNowSeconds: () => 360,
  useBlockTimestamp: () => ({ currentArmiesTick: 3, armiesTickTimeRemaining: 60 }),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { campBeside, otherArmyAt, SITE, SITE_TILE } from "@/ui/features/frontier/sites/site-fixture";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { ActorType } from "@bibliothecadao/types";
import { QuickAttackPreview } from "./quick-attack-preview";

const ARMY = 201;
const ENEMY = 301;
/** The player's army and another player's army beside it, as the attack's preview names them. */
const attacker = { type: ActorType.Explorer, id: ARMY, hex: { x: 41, y: 12 }, alt: false };
const target = { type: ActorType.Explorer, id: ENEMY, hex: { x: 42, y: 12 }, alt: false };
/** The camp beside the army, its guard the structure's: the preview's structure path. */
const camp = { type: ActorType.Structure, id: SITE, hex: { x: SITE_TILE.col, y: SITE_TILE.row }, alt: false };

afterEach(() => {
  useUIStore.getState().selectOnMap(null);
  usePopoverStore.getState().close();
  vi.unstubAllGlobals();
});

/**
 * The attack's preview over the map, the player's army selected with another tile's card open (a click elsewhere keeps
 * the army): the preview reads where the attacker stands from the attacker, never from the map's selected tile.
 */
const preview = (armyStamina: bigint, aimAt: typeof target = target) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = campBeside("Camp", true, armyStamina);
  otherArmyAt(store, target.hex.x, target.hex.y);
  // The camp's tile names it, as a Blitz structure's tile does.
  store.applyFacts([
    {
      model: "TileOccupancy",
      key: "0x7101",
      value: { game_id: 1, ...SITE_TILE, entity_id: SITE, category: 0, is_structure: true },
    },
  ] as never);
  // The other army's realm, another player's.
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  store.applyFacts([
    {
      model: "Structure",
      key: "0x92",
      value: JSON.parse(
        JSON.stringify({ ...realm, entity_id: 9, owner: "0x999" }, (_, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      ),
    },
  ] as never);
  const attack = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
  useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: { col: 30, row: 5 } });
  usePopoverStore.getState().openSurface({
    id: "quick-attack",
    anchor: { left: 0, right: 0, top: 0, bottom: 0 },
    content: null,
  });
  const host = document.createElement("div");
  document.body.append(host);
  act(() =>
    createRoot(host).render(
      <GameProvider
        value={{ store, systemCalls: { attack_explorer_vs_explorer: attack } } as unknown as GameClientSetup}
        account={{ address: "0x111", account: { address: "0x111" } } as never}
      >
        <QuickAttackPreview attacker={attacker} target={aimAt} />
      </GameProvider>,
    ),
  );
  const attackButton = () =>
    [...host.querySelectorAll("button")].find((button) => button.textContent === "Attack") as HTMLButtonElement;
  const sides = () =>
    [...host.querySelectorAll('[role="img"][aria-label*="→"]')].map((side) => side.getAttribute("aria-label"));
  return { host, attack, attackButton, sides };
};

describe("Blitz's attack preview for the selected army", () => {
  it("opens with the stamina the attack needs and Attack disabled when the army lacks it", () => {
    const { host, attack, attackButton, sides } = preview(5n);

    expect(host.querySelector("[role=alert]")?.textContent).toMatch(/^Needs \d+ stamina, have 5( · in .+)?$/);
    // The same two fight sides as every state: each side's troops now, a dash where no forecast is known.
    expect(sides()).toEqual([
      expect.stringMatching(/^Your forces [\d,]+ → —$/),
      expect.stringMatching(/^Enemy army [\d,]+ → —$/),
    ]);
    expect(attackButton().disabled).toBe(true);
    act(() => attackButton().click());
    expect(attack).not.toHaveBeenCalled();
  });

  it("draws the same two sides against a camp's guard short of stamina, the guard's troops now and a dash", () => {
    const { attackButton, sides } = preview(5n, camp);

    expect(sides()).toEqual([
      expect.stringMatching(/^Your forces [\d,]+ → —$/),
      expect.stringMatching(/^Active guard [\d,]+ → —$/),
    ]);
    expect(attackButton().disabled).toBe(true);
  });

  it("reads what each side keeps once the attack can be made", () => {
    const { sides } = preview(100n);

    expect(sides()).toHaveLength(2);
    for (const side of sides()) expect(side).not.toMatch(/→ —$/);
  });

  // Owner, 27 October 2026: "yes" to the army staying selected after an attack on a phone, as on a desktop.
  it.each([
    ["a phone", false],
    ["a desktop", true],
  ])(
    "on %s, keeps the army selected after its attack is sent, so its next order is one click away",
    async (_, desktop) => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: desktop && query.includes("min-width"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
      const { attack, attackButton } = preview(100n);

      expect(attackButton().disabled).toBe(false);
      await act(async () => attackButton().click());

      expect(attack).toHaveBeenCalledWith(expect.objectContaining({ aggressor_id: ARMY, defender_id: ENEMY }));
      expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
      expect(usePopoverStore.getState().surface).toBeNull();
    },
  );
});
