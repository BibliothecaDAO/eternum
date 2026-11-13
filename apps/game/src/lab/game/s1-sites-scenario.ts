import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { RIFT_MINE_KIND, StructureType, TileOccupier } from "@bibliothecadao/types";

import { DEEP_SCALE_HYPERSTRUCTURE, ETHEREAL_DEPTH_SCENARIOS } from "./ethereal-depths-scenario";
import { siteAt } from "./after-battle-scenario";
import { type LabFact, type LabScenario, wire } from "./lab-chain";

/** A look for one of the Deep's three sites, from a model the game already draws. */
type SiteLook = { name: string; structure?: StructureType; occupier: TileOccupier; mineKind?: number; guarded?: true };

/**
 * The looks offered for each of the Deep's three sites (the owner's pick eternum/s1-sites), a row each: the Foundation
 * (my team's hyperstructure), the Quarry (pays me labor and Essence), the Altar (fills the bar that stops a rival).
 */
const SITE_LOOKS: Record<"Foundation" | "Quarry" | "Altar", SiteLook[]> = {
  Foundation: [
    {
      name: "Hyperstructure foundation",
      structure: StructureType.Hyperstructure,
      occupier: TileOccupier.Hyperstructure,
    },
    { name: "Bank hall", structure: StructureType.Bank, occupier: TileOccupier.Bank },
    { name: "Village", structure: StructureType.Village, occupier: TileOccupier.Village },
  ],
  Quarry: [
    { name: "Fragment mine", structure: StructureType.Mine, occupier: TileOccupier.Mine, mineKind: 2 },
    { name: "Bitcoin mine", structure: StructureType.BitcoinMine, occupier: TileOccupier.BitcoinMine },
    { name: "Rift crystals", structure: StructureType.Mine, occupier: TileOccupier.Mine, mineKind: RIFT_MINE_KIND },
  ],
  Altar: [
    { name: "Shrine", occupier: TileOccupier.Shrine },
    { name: "Well", occupier: TileOccupier.Well },
    // A ruin always stands with the beast that guards it, as a Deep site starts each day behind its beast.
    { name: "Ruin", occupier: TileOccupier.Ruin, guarded: true },
  ],
};

/**
 * The Deep with every look offered for its sites (/lab/game?scenario=s1-sites): the depth proof's Deep, explored around
 * the arrival with an Aspect's hyperstructure beside it, and on those tiles a row of looks per site.
 */
export const s1SitesScenario = (
  opensOn?: (tiles: ReturnType<typeof lookTiles>) => { col: number; row: number },
): LabScenario => {
  const scenario = ETHEREAL_DEPTH_SCENARIOS["ethereal-depths-3"]!();
  const { store } = scenario;
  // The Deep's explored ground around the arrival, beside the Aspect's hyperstructure the depth proof stands there.
  const hyperstructure = store.entityOccupancy(1, DEEP_SCALE_HYPERSTRUCTURE)!;
  const deep = { col: hyperstructure.col + 1, row: hyperstructure.row + 1 };
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const facts: LabFact[] = [];
  const guard = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) }).troops;
  lookTiles(deep).forEach(({ look, tile, entity }) => {
    if (look.guarded) {
      facts.push(...siteAt(store, tile, { ...guard, count: 10_000n * 1_000_000_000n }, StructureType.Ruin));
      return;
    }
    if (look.structure !== undefined)
      facts.push({
        model: "Structure",
        key: `0x1ac${entity}`,
        value: wire({
          ...realm,
          entity_id: entity,
          owner: 0n,
          base: { ...realm.base, category: look.structure, level: 0 },
          metadata: { ...realm.metadata, realm_id: 0, order: 0, mine_kind: look.mineKind ?? 0 },
        }),
      });
    if (look.structure === StructureType.Hyperstructure)
      facts.push({
        model: "Hyperstructure",
        key: `0x1ad${entity}`,
        value: { game_id: 1, entity_id: entity, stage: "Foundation", access: "Public", seed: "0x1" },
      });
    facts.push({
      model: "TileOccupancy",
      key: `0x1ae${entity}`,
      value: {
        game_id: 1,
        alt: false,
        ...tile,
        entity_id: look.structure === undefined ? 0 : entity,
        category: look.occupier,
        is_structure: look.structure !== undefined,
      },
    });
  });
  store.applyFacts(facts as never);
  return { ...scenario, opensOn: opensOn?.(lookTiles(deep)) ?? deep };
};

/**
 * Where each look stands: three rows of three, four tiles apart, right of the arrival so no HUD panel covers a column,
 * clear of the hyperstructure beside it.
 */
const lookTiles = (deep: { col: number; row: number }) =>
  Object.values(SITE_LOOKS).flatMap((looks, row) =>
    looks.map((look, column) => ({
      look,
      tile: { col: deep.col - 3 + column * 4, row: deep.row - 3 + row * 3 },
      entity: 920 + row * 3 + column,
    })),
  );

/** The same Deep opened on each look in turn (/lab/game?scenario=s1-sites-<site>-<1..3>), for a phone's still of it. */
export const S1_SITE_LOOK_SCENARIOS = Object.fromEntries(
  Object.entries(SITE_LOOKS).flatMap(([site, looks]) =>
    looks.map((look, index) => [
      `s1-sites-${site.toLowerCase()}-${index + 1}`,
      () => s1SitesScenario((tiles) => tiles.find((placed) => placed.look === look)!.tile),
    ]),
  ),
);
