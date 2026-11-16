import { relicId } from "@/ui/features/frontier/relics/relic-catalog";
import { getHexesWithinRadius, BiomeType, TileOccupier, ResourcesIds } from "@bibliothecadao/types";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import { nativeTilePackingConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { exploreScenario } from "./explore-scenario";
import { revealedTile } from "./spire-scenario";
import { wire, type LabFact, type LabScenario } from "./lab-chain";

/** A Common Far-Eye at the fog's edge, with its first new tile finding the day's Spire. */
export function farEyeScenario(): LabScenario {
  const scenario = exploreScenario();
  const { store } = scenario;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: SPIRE_ARMY });
  const rules = store.require("SliceRules", { game_id: 1 });
  const progression = store.require("ArmyProgressionRules", { game_id: 1 });
  store.applyFacts([
    {
      model: "SliceRules",
      key: store.wireKeyOf("SliceRules", rules)!,
      value: wire({ ...rules, mode_rules: rules.mode_rules | nativeRuleConstants.DISCOVER_SPIRES }),
    },
    {
      model: "ArmyRelics",
      key: "0xfae1",
      value: wire({
        game_id: 1,
        explorer_id: SPIRE_ARMY,
        first: { kind: "FarEye", rank: 1 },
        second: null,
        third: null,
      }),
    },
  ] as never);
  return {
    ...scenario,
    opensOn: store.entityOccupancy(1, SPIRE_ARMY)!,
    answer: (command, chain, now) => {
      if (command.kind !== "ApplyRelic") return scenario.answer(command, chain, now);
      const held = chain.require("ArmyRelics", { game_id: 1, explorer_id: SPIRE_ARMY });
      const [, entityId, requested, , slot] = command.calldata.slice(4).map(Number);
      if (!held.first || entityId !== SPIRE_ARMY || slot !== 0 || requested !== relicId(held.first)) return [];
      const position = chain.entityOccupancy(1, SPIRE_ARMY)!;
      const tiles = getHexesWithinRadius(position.col, position.row, 4)
        .filter((hex) => !chain.get("TileOpt", { game_id: 1, alt: false, ...hex }))
        .slice(0, nativeRuleConstants.RELIC_TILES_PER_RANK);
      if (tiles.length !== nativeRuleConstants.RELIC_TILES_PER_RANK)
        throw new Error("Far-Eye fixture needs six unknown tiles");
      const portal = tiles[0]!;
      const progress = chain.require("ArmyProgress", { game_id: 1, explorer_id: SPIRE_ARMY });
      const balance = chain.requireOrAbsent("ResourceBalance", {
        game_id: 1,
        entity_id: army.owner,
        resource_type: ResourcesIds.Essence,
      }).known;
      if (!balance) throw new Error("Far-Eye fixture needs a synchronized Essence balance");
      const facts: LabFact[] = tiles.map((hex, index) => {
        const tile = revealedTile(`0xfae2${index}`, hex, BiomeType.Grassland);
        return {
          ...tile,
          value: {
            ...tile.value,
            data: String(BigInt(tile.value.data) + BigInt(nativeTilePackingConstants.REWARD_EXTRACTED_FLAG)),
          },
        };
      });
      return [
        ...facts,
        { model: "ArmyRelics", key: chain.wireKeyOf("ArmyRelics", held)!, value: wire({ ...held, first: null }) },
        {
          model: "ArmyProgress",
          key: chain.wireKeyOf("ArmyProgress", progress)!,
          value: wire({ ...progress, xp: progress.xp + tiles.length }),
        },
        {
          model: "ResourceBalance",
          key: chain.wireKeyOf("ResourceBalance", balance) ?? "0xfae5",
          value: wire({ ...balance, balance: balance.balance + BigInt(tiles.length) * (army.troops.count / 10n) }),
        },
        {
          model: "ExpeditionSpire",
          key: "0xfae3",
          value: wire({
            game_id: 1,
            structure_id: army.owner,
            epoch: 0,
            depth: 0,
            reveals: 1,
            location: { x: portal.col, y: portal.row, alt: false },
          }),
        },
        {
          model: "TileOccupancy",
          key: "0xfae4",
          value: wire({
            game_id: 1,
            col: portal.col,
            row: portal.row,
            alt: false,
            entity_id: 801,
            category: TileOccupier.Spire,
            is_structure: false,
          }),
        },
      ];
    },
  };
}
