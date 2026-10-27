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
import { campBeside, otherArmyAt } from "@/ui/features/frontier/sites/site-fixture";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { ActorType } from "@bibliothecadao/types";
import { QuickAttackPreview } from "./quick-attack-preview";

const ARMY = 201;
const ENEMY = 301;
/** The player's army and another player's army beside it, as the attack's preview names them. */
const attacker = { type: ActorType.Explorer, id: ARMY, hex: { x: 41, y: 12 }, alt: false };
const target = { type: ActorType.Explorer, id: ENEMY, hex: { x: 42, y: 12 }, alt: false };

afterEach(() => {
  useUIStore.getState().selectOnMap(null);
  usePopoverStore.getState().close();
});

/**
 * The attack's preview over the map, the player's army selected with another tile's card open (a click elsewhere keeps
 * the army): the preview reads where the attacker stands from the attacker, never from the map's selected tile.
 */
const preview = (armyStamina: bigint) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = campBeside("Camp", true, armyStamina);
  otherArmyAt(store, target.hex.x, target.hex.y);
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
        <QuickAttackPreview attacker={attacker} target={target} />
      </GameProvider>,
    ),
  );
  const attackButton = () =>
    [...host.querySelectorAll("button")].find((button) => button.textContent === "Attack") as HTMLButtonElement;
  return { host, attack, attackButton };
};

describe("Blitz's attack preview for the selected army", () => {
  it("opens with the stamina the attack needs and Attack disabled when the army lacks it", () => {
    const { host, attack, attackButton } = preview(5n);

    expect(host.querySelector("[role=alert]")?.textContent).toMatch(/^Needs \d+ stamina, have 5( · in .+)?$/);
    expect(attackButton().disabled).toBe(true);
    act(() => attackButton().click());
    expect(attack).not.toHaveBeenCalled();
  });

  it("keeps the army selected after its attack is sent, so its next order is one click away", async () => {
    const { attack, attackButton } = preview(100n);

    expect(attackButton().disabled).toBe(false);
    await act(async () => attackButton().click());

    expect(attack).toHaveBeenCalledWith(expect.objectContaining({ aggressor_id: ARMY, defender_id: ENEMY }));
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
    expect(usePopoverStore.getState().surface).toBeNull();
  });
});
