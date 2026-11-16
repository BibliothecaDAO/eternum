import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { expect, it } from "vitest";
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
