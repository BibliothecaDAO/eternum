import { expect, it } from "vitest";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { chainOf } from "./lab-chain";
import { upkeepScenario } from "./upkeep-scenario";

const ARMY = { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) };

/** The army's bar as the contract keeps a Frontier army's: in its home's army slot. */
const slotBar = (chain: ReturnType<typeof chainOf>) =>
  [...chain.entries("ArmySlot")].find(([, row]) => row.explorer_id === BigInt(SPIRE_ARMY))![1].stamina.amount;

it("keeps the army's bar in its slot, as an army with progress always is on chain", () => {
  const chain = chainOf(upkeepScenario());
  expect(chain.require("ExplorerTroops", ARMY).troops.stamina).toEqual({ Slot: 0 });
  expect(slotBar(chain)).toBe(40n);
});

it("refills the bar to the maximum the client draws: the troop's base and its Logistics", () => {
  const game = upkeepScenario();
  const chain = chainOf(game);
  const maximum = resolveExplorerTroops(chain, chain.require("ExplorerTroops", ARMY))!.staminaMax!;
  chain.applyFacts(
    game.answer(
      { kind: "RefillStamina", fields: { explorer_id: String(SPIRE_ARMY) }, calldata: [] },
      chain,
      game.startsAt,
    ) as never,
  );
  expect(maximum).toBe(140);
  expect(slotBar(chain)).toBe(BigInt(maximum));
});

it("spends the fitting skill point for Battle, retaining earned XP and refilling the army", () => {
  const game = upkeepScenario();
  const chain = chainOf(game);
  const before = chain.require("ArmyProgress", ARMY);
  const result = game.answer(
    { kind: "SpendSkillPoint", fields: {}, calldata: ["1", "3", "0", "2", "0", String(SPIRE_ARMY), "0"] },
    chain,
    game.startsAt,
  );
  chain.applyFacts(result as never);
  expect(chain.require("ArmyProgress", ARMY)).toEqual({ ...before, battle: 2, uncommon_points: 0 });
  expect(slotBar(chain)).toBe(70n);
});
