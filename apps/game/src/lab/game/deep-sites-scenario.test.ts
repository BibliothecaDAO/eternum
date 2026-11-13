import { configManager } from "@bibliothecadao/eternum";
import { deepSites } from "@bibliothecadao/types";
import { expect, it, vi } from "vitest";

import { readDeepSiteCard } from "@/ui/features/frontier/deep/deep-site-plan";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";

import { deepSitesScenario } from "./deep-sites-scenario";
import { chainOf, keyedAsHeldOnChain, type LabCommand } from "./lab-chain";

/** InteractSite as the play call carries it: four header felts, the variant, the army, then the tile (alt, x, y). */
const interactSite = (tile: { col: number; row: number }): LabCommand => ({
  kind: "InteractSite",
  fields: {},
  calldata: ["0", "0", "0", "0", "21", String(SPIRE_ARMY), "0", String(tile.col), String(tile.row)],
});

it("stands the Deep's three sites and answers Join as deep_guards.cairo writes it", () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const scenario = deepSitesScenario();
  const chain = chainOf(scenario);
  const now = scenario.startsAt;
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: SPIRE_ARMY });
  const tile = chain.entityOccupancy(1, SPIRE_ARMY)!;
  const actor = { army, tile: { col: tile.col, row: tile.row } };
  const siteTile = (position: "foundation" | "quarry" | "altar") => {
    const kind = deepSites.find((each) => each.position === position)!.id;
    const site = [...chain.entries("DeepSite")].find(([, row]) => row.kind === kind)![1];
    const at = chain.entityOccupancy(1, site.entity_id)!;
    return { col: at.col, row: at.row };
  };
  const [foundation, quarry, altar] = [siteTile("foundation"), siteTile("quarry"), siteTile("altar")];
  const card = (at: { col: number; row: number }) =>
    readDeepSiteCard(chain, 1, at, actor, BigInt(scenario.player), now);
  expect(card(foundation)).toMatchObject({ kind: "site", step: { kind: "join" }, inReach: true });
  expect(card(quarry)).toMatchObject({
    kind: "site",
    guard: { kind: "beast", troops: 10_000 },
    step: { kind: "attack" },
  });
  expect(card(altar)).toMatchObject({ kind: "site", guard: { kind: "held", aspect: 3 }, step: { kind: "rival" } });

  const answered = scenario.answer(interactSite(foundation), chain, now);
  expect(() => JSON.stringify(answered)).not.toThrow();
  chain.applyFacts(answered.map(keyedAsHeldOnChain) as never);
  expect(chain.entityOccupancy(1, SPIRE_ARMY)).toBeUndefined();
  const joined = card(foundation);
  if (joined?.kind !== "site" || joined.guard.kind !== "held") throw new Error("the Foundation is not held");
  // Fought from the highest slot: the player's new army in slot 1 first, then the mate's in slot 0.
  expect(joined.guard.slots.map(({ slot, mine }) => ({ slot, mine }))).toEqual([
    { slot: 1, mine: true },
    { slot: 0, mine: false },
  ]);
  expect(joined.step).toEqual({ kind: "guarding" });
  // Another Aspect's site, or a second army of a player: the chain refuses the Join as the contract does.
  expect(scenario.answer(interactSite(altar), chain, now)).toEqual([]);
});
