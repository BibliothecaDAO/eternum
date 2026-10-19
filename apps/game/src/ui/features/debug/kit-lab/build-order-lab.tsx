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
import type { NextStep } from "@/ui/features/world/hud/next-step";
import { NextUpView } from "@/ui/features/world/hud/next-up";
import { type ReactNode, useState } from "react";

/**
 * The owner's pick (19 October): a Build order panel of its own, a dropdown of the player's orders with the owner's
 * as the default, and for every realm only its next step, once it can be taken; done steps never show. Next up stays
 * how to play for a newcomer. Everything here is fixture data drawn with the HUD's own elements: the proposal, before
 * any of it is built.
 */

/** The default order as a player would write it: "<how many> <building>" a line, under the rank it starts at. */
const DEFAULT_ORDER = `Settlement:
2 farm
City:
4 farm
1 wood
1 coal
1 copper
2 wood
2 coal
2 copper
1 military
Kingdom:
8 farm
3 wood
3 coal
3 copper
4 wood
4 coal
4 copper
3 military
Empire:
12 farm
5 wood
5 coal
5 copper
6 wood
6 coal
6 copper
5 military`;

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
  why: "Population 5 of 6",
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
  {
    key: "default-order:egonal",
    kind: "order",
    line: "Egonal: build a wood camp (2 of 2), the default order's next step.",
    verb: "Build wood camp",
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
 * The panel: its order at its head (a dropdown once there is more than one), then one row per realm whose next step
 * can be taken now; a realm waiting on resources, or done with the order, has no row.
 */
const BuildOrderPanel = ({ phase }: { phase: 1 | 2 }) => {
  const [order, setOrder] = useState<OrderKey>("default");
  return (
    <HudPanel
      label="Build order"
      title="Build order"
      icon="build"
      cue={
        phase === 1 ? (
          <span className="text-hud-label text-hud-muted">{ORDERS.default.name}</span>
        ) : (
          <HudSelect
            label="Build order"
            value={order}
            onChange={setOrder}
            options={(Object.keys(ORDERS) as OrderKey[]).map((key) => ({ value: key, label: ORDERS[key].name }))}
          />
        )
      }
      bodyClassName="flex flex-col"
    >
      {ORDERS[order].steps.map((step) => (
        <StepRow key={step.realm} step={step} />
      ))}
      {phase === 2 && (
        <div className="flex pt-2">
          <HudButton kind="quiet" size="sm" icon="plus">
            Import an order
          </HudButton>
        </div>
      )}
    </HudPanel>
  );
};

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
      <HudNotice
        tone="bad"
        line="Line 3: “mill” is not a building of an order"
        why="Farm, wood, coal, copper, hut or military."
      />
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
        line="How to play: the points coach first (raise an army, explore, a crate); the default order's next building is among its pages. As today."
      >
        <NextUpView steps={NEWCOMER_STEPS} />
      </Shown>
      <Shown
        name="Phase 1 · the panel"
        line="Under Next up in the rail, on the default order, for every realm: only a step it can take now, never one done. Stolsli's level-up and Grimwatch's hut are the two rules that always come first."
      >
        <BuildOrderPanel phase={1} />
      </Shown>
      <Shown
        name="Phase 2 · a player's orders"
        line="The dropdown once a player has imported an order: pick Coal rush and Egonal's step changes. Import an order opens the window beside it."
      >
        <BuildOrderPanel phase={2} />
      </Shown>
      <Shown
        name="Phase 2 · importing"
        line="An order pasted as text. Each line that cannot be read is named, and nothing is kept until every line can."
      >
        <ImportWindow />
      </Shown>
      <Shown
        name="The order, as written"
        line="The default order (left) in the same text a player writes and shares, and a player's own (right). Two rules need no line: level up when the realm can, and a worker hut when population is 3 from full."
      >
        <div className="flex items-start gap-3">
          <pre className="rounded border border-white/10 p-3 font-mono text-xs text-white/80">{DEFAULT_ORDER}</pre>
          <pre className="rounded border border-white/10 p-3 font-mono text-xs text-white/80">{COAL_RUSH}</pre>
        </div>
      </Shown>
    </div>
  );
};
