import { useDocumentClass } from "@/hooks/use-document-class";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudNotice,
  HudPanel,
  HudRow,
  HudSelect,
  HudWindow,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { decorateSuggestion } from "@/ui/features/world/containers/left-facets/use-empire-suggestions";
import { BuildOrderRow, BuildOrderView, STEP_VERBS } from "@/ui/features/world/hud/build-order-panel";
import type { NextStep } from "@/ui/features/world/hud/next-step";
import { NextUpView } from "@/ui/features/world/hud/next-up";
import {
  type BlitzArmyState,
  type BlitzRealmSuggestionInput,
  buildBlitzRealmSuggestions,
  DEFAULT_BUILD_ORDER_TEXT,
} from "@bibliothecadao/eternum/automation";
import { BuildingType, ResourcesIds, TroopType } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";

/**
 * The owner's pick (19 October): a Build order panel of its own, a dropdown of the player's orders with the owner's
 * as the default, and for every realm only its next step, once it can be taken; done steps never show. Next up stays
 * how to play for a newcomer. Everything here is fixture data drawn with the HUD's own elements: the proposal, before
 * any of it is built.
 */

/** A player's own order, pasted in: coal and copper first, then farms. */
const COAL_RUSH = `Name: Coal rush
City:
2 coal
2 copper
4 farm
2 wood
1 military`;

/** A realm's next step under the chosen order, when it can be taken now. */
type RealmStep = { realm: string; rank: string; icon: IconMeaning; step: string; verb: string; why: string };

const LEVEL_UP: RealmStep = {
  realm: "Stolsli",
  rank: "City",
  icon: "realm-2",
  step: "Level up to Kingdom",
  verb: "Level up",
  why: "Always first when it can",
};
const HUT: RealmStep = {
  realm: "Grimwatch",
  rank: "Settlement",
  icon: "workers-hut",
  step: "Worker hut",
  verb: "Build",
  why: "No room for the next farm",
};

const ORDERS = {
  default: {
    name: "Default · djizus",
    steps: [{ ...HUT, realm: "Egonal", rank: "City", icon: "wood", step: "Wood camp", why: "2 of 2" }, LEVEL_UP, HUT],
  },
  "coal-rush": {
    name: "Coal rush · imported",
    steps: [{ ...HUT, realm: "Egonal", rank: "City", icon: "coal", step: "Coal mine", why: "2 of 2" }, LEVEL_UP, HUT],
  },
} satisfies Record<string, { name: string; steps: RealmStep[] }>;
type OrderKey = keyof typeof ORDERS;

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

/** A realm's next step: the realm and its step, its rank and why, and its one verb. */
const StepRow = ({ step }: { step: RealmStep }) => (
  <HudRow
    lead={<Icon name={step.icon} size={28} />}
    title={`${step.realm} · ${step.step}`}
    detail={`${step.rank} · ${step.why}`}
    trail={
      <HudButton kind="secondary" size="sm">
        {step.verb}
      </HudButton>
    }
  />
);

/**
 * Phase 2, proposed: the order at the panel's head becomes a dropdown once a player has an order of their own, and
 * Import an order sits at its foot.
 */
const ImportedOrdersPanel = () => {
  const [order, setOrder] = useState<OrderKey>("default");
  return (
    <HudPanel
      label="Build order"
      title="Build order"
      icon="build"
      cue={
        <HudSelect
          label="Build order"
          value={order}
          onChange={setOrder}
          options={(Object.keys(ORDERS) as OrderKey[]).map((key) => ({ value: key, label: ORDERS[key].name }))}
        />
      }
      bodyClassName="flex flex-col"
    >
      {ORDERS[order].steps.map((step) => (
        <StepRow key={step.realm} step={step} />
      ))}
      <div className="flex pt-2">
        <HudButton kind="quiet" size="sm" icon="plus">
          Import an order
        </HudButton>
      </div>
    </HudPanel>
  );
};

/** A realm whose every build can be paid and has room, as the construction rule would judge it. */
const BUILDABLE: BlitzRealmSuggestionInput["buildability"] = {
  copper: { canBuild: true, needsRoom: false },
  coal: { canBuild: true, needsRoom: false },
  military: { canBuild: true, needsRoom: false },
  wheat: { canBuild: true, needsRoom: false },
  wood: { canBuild: true, needsRoom: false },
  workerHut: { canBuild: true, needsRoom: false },
};
const KNIGHTS = {
  buildingType: BuildingType.ResourceKnightT1,
  label: "Knight T1",
  resource: ResourcesIds.Knight,
  troopType: TroopType.Knight,
};
const CITY_BUILT = { wheat: 4, wood: 2, coal: 2, copper: 2, workerHut: 1, crossbowmanT1: 0, knightT1: 1, paladinT1: 0 };
const ARMY: BlitzArmyState = { armies: 0, maxArmies: 3, troops: 0, fullArmy: 3_000 };

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
  buildingCounts: { ...CITY_BUILT, wheat: 0, wood: 0, coal: 0, copper: 0, knightT1: 0 },
  population: 4,
  populationCapacity: 12,
  militaryTarget: { ...KNIGHTS, count: 0 },
  army: ARMY,
  buildability: BUILDABLE,
  ...input,
});

/** Realms where the player's reports came from, each with the step the game's own rule gives it. */
const SITUATIONS: { situation: string; input: BlitzRealmSuggestionInput }[] = [
  {
    situation: "Population 9 of 12, a farm next: a farm needs 1",
    input: realm(1, "Egonal", {
      population: 9,
      buildingCounts: { ...CITY_BUILT, wheat: 2, wood: 0, coal: 0, copper: 0 },
    }),
  },
  {
    situation: "Population 11 of 12, a wood camp next: it needs 2",
    input: realm(2, "Grimwatch", {
      population: 11,
      buildingCounts: { ...CITY_BUILT, wood: 0, coal: 0, copper: 0, knightT1: 0 },
      buildability: { ...BUILDABLE, wood: { canBuild: false, reason: "Need more population.", needsRoom: true } },
    }),
  },
  {
    situation: "Kingdom, Knights short of a full army: automation trains them, the order goes on",
    input: realm(4, "Corwin", {
      realmLevel: 2,
      buildingCounts: CITY_BUILT,
      militaryTarget: { ...KNIGHTS, count: 1 },
      army: { ...ARMY, troops: 1_200 },
    }),
  },
  {
    situation: "A full army of Knights on hand",
    input: realm(5, "Ysabeau", {
      buildingCounts: CITY_BUILT,
      militaryTarget: { ...KNIGHTS, count: 1 },
      army: { ...ARMY, troops: 3_000 },
    }),
  },
];

/** The panel as built, on the default order: each situation's row as the game's own rule writes it, under its case. */
const PhaseOnePanel = () => (
  <BuildOrderView orderName="Default">
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

/** Phase 2's import: an order pasted as text, read line by line, each refusal naming its line. */
const ImportWindow = () => (
  <HudWindow title="Import a build order" icon="build" size="fit" onClose={run}>
    <HudWindowFoot>
      <HudButton kind="quiet">Cancel</HudButton>
      <HudButton kind="primary" disabled>
        Import
      </HudButton>
    </HudWindowFoot>
    <div className="flex w-80 flex-col gap-3">
      <pre className="rounded border border-hud-line bg-hud-well p-3 font-mono text-hud-label text-hud-ink">
        {`Name: Mill first\nCity:\n2 mill\n4 farm`}
      </pre>
      <HudNotice tone="bad" line="Line 3: “mill” is not a goal of an order" />
    </div>
  </HudWindow>
);

const Shown = ({ name, line, children }: { name: string; line: string; children: ReactNode }) => (
  <section data-sheet-element={name} className="flex w-hud-column flex-col gap-2">
    <h2 className="text-sm font-semibold text-white">{name}</h2>
    <p className="text-xs text-white/60">{line}</p>
    {children}
  </section>
);

/**
 * Dev only, for the owner: the Build order panel as build-order-2 proposes it, at /lab/kit/build-order. Next up for a
 * newcomer, phase 1 (the panel on the default order), phase 2 (orders a player imports, and the import), and the
 * default order as written.
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
        name="Phase 1 · the panel"
        line="Built: the game's own panel, under Next up in a Blitz's rail, on the default order, each row from the game's own rule. A worker hut only when the next step needs the room; after the barracks, its troops trained, then the first army deployed."
      >
        <PhaseOnePanel />
      </Shown>
      <Shown
        name="Phase 2 · a player's orders"
        line="The dropdown once a player has imported an order: pick Coal rush and Egonal's step changes. Import an order opens the window beside it."
      >
        <ImportedOrdersPanel />
      </Shown>
      <Shown
        name="Phase 2 · importing"
        line="An order pasted as text. Each line that cannot be read is named, and nothing is kept until every line can."
      >
        <ImportWindow />
      </Shown>
      <Shown
        name="The order, as written"
        line="The default order (left) in the same text a player writes and shares, and a player's own (right). Two rules need no line: level up when the realm can, and a worker hut when the next step needs the room."
      >
        <div className="flex items-start gap-3">
          <pre className="rounded border border-white/10 p-3 font-mono text-xs text-white/80">
            {DEFAULT_BUILD_ORDER_TEXT}
          </pre>
          <pre className="rounded border border-white/10 p-3 font-mono text-xs text-white/80">{COAL_RUSH}</pre>
        </div>
      </Shown>
    </div>
  );
};
