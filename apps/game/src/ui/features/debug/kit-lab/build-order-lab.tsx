import { useDocumentClass } from "@/hooks/use-document-class";
import { decorateSuggestion } from "@/ui/features/world/containers/left-facets/use-empire-suggestions";
import { BuildOrderRow, BuildOrderView, OrderChoice, STEP_VERBS } from "@/ui/features/world/hud/build-order-panel";
import type { NextStep } from "@/ui/features/world/hud/next-step";
import { NextUpView } from "@/ui/features/world/hud/next-up";
import {
  type BlitzArmyState,
  type BlitzRealmSuggestionInput,
  type BlitzTroop,
  type BuildOrderBook,
  buildBlitzRealmSuggestions,
  readBuildOrderText,
} from "@bibliothecadao/eternum/automation";
import { BuildingType, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";

/**
 * The owner's picks (19 and 26 October): a Build order panel of its own, for every realm only its next step once it
 * can be taken, and the maker: the player's orders on their account, made from step cards, copied and pasted as JSON,
 * with a prompt for an AI. Next up stays how to play for a newcomer. Fixture data, drawn by the game's own components.
 */

const run = () => undefined;

/** Next up, kept for a newcomer: the points coach's step first; the default order's next building is one of its pages. */
const NEWCOMER_STEPS: NextStep[] = [
  {
    key: "coach:explore",
    kind: "order",
    line: "Your army can explore: +5 points a tile.",
    verb: "Select the army",
    busy: false,
    run,
  },
];

/** A realm whose every build can be paid and has room, as the construction rule would judge it. */
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

/**
 * The panel as built, on a fixture account's orders, Coal rush followed (its choice picks another here, saving nothing):
 * each situation's row as the game's own rule writes it, under its case.
 */
const PhaseOnePanel = () => {
  const [book, setBook] = useState(labBook);
  return (
    <BuildOrderView
      choice={<OrderChoice book={book} busy={false} onFollow={(active) => setBook({ ...book, active })} />}
      onOrders={run}
    >
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
};

const Shown = ({ name, line, children }: { name: string; line: string; children: ReactNode }) => (
  <section data-sheet-element={name} className="flex w-hud-column flex-col gap-2">
    <h2 className="text-sm font-semibold text-white">{name}</h2>
    <p className="text-xs text-white/60">{line}</p>
    {children}
  </section>
);

/**
 * Dev only, for the owner: the Build order panel, at /lab/kit/build-order. Next up for a newcomer, and the panel on a
 * fixture account holding two orders. Orders are made on the app's Build orders page (/lab/app/home/blitz/build-orders).
 */
export const BuildOrderLab = () => {
  useDocumentClass("classic-hud");
  return (
    <div className="flex min-h-screen flex-wrap items-start gap-8 bg-[#0b1418] p-6">
      <Shown
        name="Next up, for a newcomer"
        line="How to play: the points coach (raise an army, explore, a crate). The build order's steps are the panel's alone (owner, 10-20: remove build steps in Next up)."
      >
        <NextUpView steps={NEWCOMER_STEPS} />
      </Shown>
      <Shown
        name="The panel"
        line="The game's own panel, under Next up in a Blitz's rail. Its head chooses the order to follow; its pencil opens the app's Build orders page, where orders are made (lab: /lab/app/home/blitz/build-orders). Each row from the game's own rule."
      >
        <PhaseOnePanel />
      </Shown>
    </div>
  );
};

/** Two orders a player saved, Coal rush the one followed. */
const LAB_ORDERS = [
  {
    id: "coal-rush",
    json: `{"name":"Coal rush","steps":[{"rank":"Settlement","goal":"farm","count":2},{"rank":"City","goal":"coal","count":2},{"rank":"City","goal":"copper","count":2},{"rank":"City","goal":"levelUp"},{"rank":"City","goal":"barracks","count":1},{"rank":"Kingdom","goal":"army","count":1}]}`,
  },
  {
    id: "wood-first",
    json: `{"name":"Wood first","steps":[{"rank":"Settlement","goal":"wood","count":2},{"rank":"City","goal":"farm","count":4}]}`,
  },
];

const labBook = (): BuildOrderBook => ({
  orders: LAB_ORDERS.map(({ id, json }) => {
    const read = readBuildOrderText(json);
    if ("error" in read) throw new Error(read.error);
    return { id, order: read.ok };
  }),
  active: "coal-rush",
});
