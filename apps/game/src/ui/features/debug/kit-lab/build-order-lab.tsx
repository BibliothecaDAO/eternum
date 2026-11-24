import { useDocumentClass } from "@/hooks/use-document-class";
import { decorateSuggestion } from "@/ui/features/world/containers/left-facets/use-empire-suggestions";
import { BuildOrderRow, BuildOrderView, STEP_VERBS } from "@/ui/features/world/hud/build-order-panel";
import {
  type BlitzArmyState,
  type BlitzRealmSuggestionInput,
  type BlitzTroop,
  buildBlitzRealmSuggestions,
} from "@bibliothecadao/eternum/automation";
import { BuildingType, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import type { ReactNode } from "react";

/**
 * The owner's picks (19 and 26 October): a Build order panel of its own, for every realm only its next step once it
 * can be taken, and the maker: the player's orders on their account, made from step cards, copied and pasted as JSON,
 * with a prompt for an AI. Next up stays how to play for a newcomer. Fixture data, drawn by the game's own components.
 */

const run = () => undefined;

const BUILDABLE: BlitzRealmSuggestionInput["buildability"] = () => ({ canBuild: true, needsRoom: false });
const KNIGHTS: BlitzTroop = {
  type: TroopType.Knight,
  tiers: {
    [TroopTier.T1]: { building: BuildingType.ResourceKnightT1, resource: ResourcesIds.Knight },
    [TroopTier.T2]: { building: BuildingType.ResourceKnightT2, resource: ResourcesIds.KnightT2 },
    [TroopTier.T3]: { building: BuildingType.ResourceKnightT3, resource: ResourcesIds.KnightT3 },
  },
};
type Built = Partial<Record<BuildingType, number>>;
const CITY_BUILT: Built = {
  [BuildingType.ResourceWheat]: 4,
  [BuildingType.ResourceWood]: 2,
  [BuildingType.ResourceCoal]: 2,
  [BuildingType.ResourceCopper]: 2,
  [BuildingType.WorkersHut]: 1,
  [BuildingType.ResourceKnightT1]: 1,
};
const counted = (built: Built) => (building: BuildingType) => built[building] ?? 0;
const army = (knights: number): BlitzArmyState => ({
  armies: [],
  maxArmies: 3,
  troopsOnHand: (resource) => (resource === ResourcesIds.Knight ? knights : 0),
  fullArmy: () => 3_000,
});

const realm = (
  realmId: number,
  realmName: string,
  input: Partial<BlitzRealmSuggestionInput>,
): BlitzRealmSuggestionInput => ({
  realmId,
  realmName,
  realmLevel: 1,
  isBlitzActive: true,
  canAffordUpgrade: false,
  hasAvailableBuildingTile: true,
  built: counted({ [BuildingType.WorkersHut]: 1 }),
  population: 4,
  populationCapacity: 12,
  troop: KNIGHTS,
  army: army(0),
  buildability: BUILDABLE,
  ...input,
});

/** Realms where the player's reports came from, each with the step the game's own rule gives it. */
const SITUATIONS: { situation: string; input: BlitzRealmSuggestionInput }[] = [
  {
    situation: "Population 9 of 12, a farm next: a farm needs 1",
    input: realm(1, "Egonal", {
      population: 9,
      built: counted({ [BuildingType.WorkersHut]: 1, [BuildingType.ResourceWheat]: 2 }),
    }),
  },
  {
    situation: "Population 11 of 12, a wood camp next: it needs 2",
    input: realm(2, "Grimwatch", {
      population: 11,
      built: counted({ [BuildingType.WorkersHut]: 1, [BuildingType.ResourceWheat]: 4 }),
      buildability: (building) =>
        building === BuildingType.ResourceWood
          ? { canBuild: false, reason: "Need more population.", needsRoom: true }
          : { canBuild: true, needsRoom: false },
    }),
  },
  {
    situation: "Kingdom, Knights short of a full army: automation trains them, the order goes on",
    input: realm(4, "Corwin", { realmLevel: 2, built: counted(CITY_BUILT), army: army(1_200) }),
  },
  {
    situation: "A full army of Knights on hand",
    input: realm(5, "Ysabeau", { built: counted(CITY_BUILT), army: army(3_000) }),
  },
];

const PhaseOnePanel = () => (
  <BuildOrderView>
    {SITUATIONS.map(({ situation, input }) => {
      const [draft] = buildBlitzRealmSuggestions(input);
      const step = draft && decorateSuggestion(draft);
      return (
        <div key={input.realmName} data-situation={input.realmName}>
          <p className="text-hud-label text-hud-muted">{situation}</p>
          {step && step.action !== "upgrade" ? (
            <BuildOrderRow step={step} verb={STEP_VERBS[step.action]} busy={false} refusal={null} onPress={run} />
          ) : (
            <p className="text-hud-label text-hud-ink">{input.realmName}: nothing to take now.</p>
          )}
        </div>
      );
    })}
  </BuildOrderView>
);

const Shown = ({ name, line, children }: { name: string; line: string; children: ReactNode }) => (
  <section data-sheet-element={name} className="flex w-hud-column flex-col gap-2">
    <h2 className="text-sm font-semibold text-white">{name}</h2>
    <p className="text-xs text-white/60">{line}</p>
    {children}
  </section>
);

export const BuildOrderLab = () => {
  useDocumentClass("classic-hud");
  return (
    <div className="flex min-h-screen flex-wrap items-start gap-8 bg-[#0b1418] p-6">
      <Shown name="The panel" line="The game's own build order panel. Each row from the game's own rule.">
        <PhaseOnePanel />
      </Shown>
    </div>
  );
};
