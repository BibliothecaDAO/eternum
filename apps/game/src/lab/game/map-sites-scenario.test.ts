import { describe, expect, it } from "vitest";

import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { armyBar } from "@/ui/features/frontier/hud/dock-armies";
import { armyOaths, oathWellStamina } from "@bibliothecadao/eternum";
import { TileOccupier } from "@bibliothecadao/types";

import { chainOf } from "./lab-chain";
import { mapSitesScenario } from "./map-sites-scenario";

const useAt = (category: TileOccupier) => {
  const game = mapSitesScenario();
  const chain = chainOf(game);
  const site = [...chain.rows("TileOccupancy")].find((row) => Number(row.category) === category)!;
  const span = ["0x0", `${SPIRE_ARMY}`, "0x0", `${site.col}`, `${site.row}`];
  const facts = game.answer({ kind: "InteractSite", fields: {}, span }, chain, game.startsAt);
  return { chain, game, site, facts };
};

describe("a standing Shrine or Well used by the army beside it, as release 24's contract answers", () => {
  it("clears the Well and refills the army by the Well's share of its maximum, capped", () => {
    const { chain, game, facts } = useAt(TileOccupier.Well);
    const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
    const bar = armyBar(chain, army, game.startsAt).stamina!;
    const granted = Math.min(oathWellStamina(armyOaths(chain, army), bar.max), bar.max - bar.current);
    expect(facts.some(({ model, value }) => model === "TileOccupancy" && value === null)).toBe(true);
    const story = facts.find(({ model }) => model === "StoryEvent")!.value as {
      story: { SiteUsed: { benefit: unknown } };
    };
    expect(story.story.SiteUsed.benefit).toEqual({ Well: granted });
    chain.applyFacts(facts.filter(({ model }) => model !== "StoryEvent") as never);
    const after = chain.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
    expect(armyBar(chain, after, game.startsAt).stamina!.current).toBe(bar.current + granted);
  });

  it("clears the Shrine and draws the army's Oath pick", () => {
    const { chain, facts } = useAt(TileOccupier.Shrine);
    chain.applyFacts(facts.filter(({ model }) => model !== "StoryEvent") as never);
    expect(chain.require("ArmyProgress", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) }).oath_pick).not.toBe(0);
    expect([...chain.rows("TileOccupancy")].some((row) => Number(row.category) === TileOccupier.Shrine)).toBe(false);
    const story = facts.find(({ model }) => model === "StoryEvent")!.value as {
      story: { SiteUsed: { benefit: unknown } };
    };
    expect(story.story.SiteUsed.benefit).toEqual({ Shrine: 0 });
  });
});
