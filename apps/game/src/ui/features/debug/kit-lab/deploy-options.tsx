import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudTabs,
  HudTierChip,
  HudTroopAmount,
  HudWindow,
} from "@/ui/design-system/kit/hud-elements";
import { useState } from "react";

import { Element } from "./sheet-element";

/**
 * The owner's round 4 (owner-deploy-window-r4.png): "especially the deploy army one I'm not fond of". Three layouts for
 * deploying an army, each drawn twice, as the map's picker (a tile beside the realm, right-clicked) and as the Military
 * window's create-army form, built only from the sheet's elements and laid out for speed: the troop choice in sight,
 * the amount with +500 and Max beside it, one Deploy carrying its cost, no Cancel beside the close.
 */

type TroopType = "knight" | "crossbowman" | "paladin";
type Tier = 1 | 2 | 3;
type Stack = { type: TroopType; tier: Tier; held: number };

const TYPES: readonly { type: TroopType; name: string; short: string }[] = [
  { type: "knight", name: "Knights", short: "Knight" },
  { type: "crossbowman", name: "Crossbowmen", short: "Crossbow" },
  { type: "paladin", name: "Paladins", short: "Paladin" },
];

/** A realm's garrison: what each troop and tier holds. */
const GARRISON: readonly Stack[] = [
  { type: "knight", tier: 1, held: 2_400 },
  { type: "knight", tier: 2, held: 600 },
  { type: "knight", tier: 3, held: 0 },
  { type: "crossbowman", tier: 1, held: 1_200 },
  { type: "crossbowman", tier: 2, held: 0 },
  { type: "crossbowman", tier: 3, held: 0 },
  { type: "paladin", tier: 1, held: 900 },
  { type: "paladin", tier: 2, held: 300 },
  { type: "paladin", tier: 3, held: 120 },
];

/** How many fit in a new army (the realm's army room), and what one troop costs to field. */
const ROOM = 1_800;
const WHEAT_A_TROOP = 1;

const format = (amount: number) => amount.toLocaleString("en-US");
const painting = (stack: Pick<Stack, "type" | "tier">) => `${stack.type}-t${stack.tier}` as IconMeaning;
const nameOf = (type: TroopType) => TYPES.find((entry) => entry.type === type)!.name;
const shortOf = (type: TroopType) => TYPES.find((entry) => entry.type === type)!.short;
const sameStack = (a: Pick<Stack, "type" | "tier">, b: Pick<Stack, "type" | "tier">) =>
  a.type === b.type && a.tier === b.tier;

/** One deploy's state: the stack chosen and how many go, kept within what fits. */
const useDeploy = (first: Stack) => {
  const [stack, setStack] = useState<Stack>(first);
  const [amount, setAmount] = useState(Math.min(500, first.held, ROOM));
  const most = Math.min(stack.held, ROOM);
  return {
    stack,
    amount,
    most,
    choose: (next: Stack) => {
      setStack(next);
      setAmount(Math.min(amount, next.held, ROOM));
    },
    setAmount,
  };
};

type Deploy = ReturnType<typeof useDeploy>;

/** A troop stack as a pressable choice: its painting, its name where nothing else says it, its tier, what it holds. */
const StackButton = ({ stack, deploy, named = false }: { stack: Stack; deploy: Deploy; named?: boolean }) => (
  <HudButton
    kind="secondary"
    size="sm"
    disabled={stack.held === 0}
    aria-pressed={sameStack(stack, deploy.stack)}
    aria-label={`${nameOf(stack.type)} T${stack.tier}, ${format(stack.held)} held`}
    onClick={() => deploy.choose(stack)}
  >
    <Icon name={painting(stack)} size={20} />
    {named && shortOf(stack.type)}
    <HudTierChip tier={stack.tier} />
    {stack.held > 0 ? format(stack.held) : "none"}
  </HudButton>
);

const Amount = ({ deploy }: { deploy: Deploy }) => (
  <HudTroopAmount
    name={`${nameOf(deploy.stack.type)} T${deploy.stack.tier}`}
    value={deploy.amount}
    most={deploy.most}
    held={deploy.stack.held}
    onChange={deploy.setAmount}
  />
);

/** The one verb, with what it costs on it. */
const DeployButton = ({ deploy }: { deploy: Deploy }) => (
  <HudButton kind="primary" icon="military" disabled={deploy.amount === 0}>
    Deploy · {format(deploy.amount * WHEAT_A_TROOP)} wheat
  </HudButton>
);

/** Option A: only the stacks the realm holds, as one row of choices; the rest are not drawn. */
const HeldStacks = ({ deploy }: { deploy: Deploy }) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Troops held">
      {GARRISON.filter((stack) => stack.held > 0)
        .toSorted((a, b) => b.tier - a.tier || b.held - a.held)
        .map((stack) => (
          <StackButton key={painting(stack)} stack={stack} deploy={deploy} named />
        ))}
    </div>
    <Amount deploy={deploy} />
  </div>
);

/** Option B: a column per troop, its tiers under its name, every one drawn (an empty one dimmed). */
const TroopColumns = ({ deploy }: { deploy: Deploy }) => (
  <div className="flex flex-col gap-3">
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Troops">
      {TYPES.map(({ type, name }) => (
        <div key={type} className="flex flex-col gap-1.5">
          <span className="text-hud-label text-hud-muted">{name}</span>
          {GARRISON.filter((stack) => stack.type === type).map((stack) => (
            <StackButton key={painting(stack)} stack={stack} deploy={deploy} />
          ))}
        </div>
      ))}
    </div>
    <Amount deploy={deploy} />
  </div>
);

/** Option C: the troop as tabs, then its tiers (with what each holds) as one row. */
const TroopTabs = ({ deploy }: { deploy: Deploy }) => (
  <div className="flex flex-col gap-3">
    <HudTabs
      tabs={TYPES.map(({ type, short }) => ({ key: type, label: short }))}
      value={deploy.stack.type}
      onChange={(type) =>
        deploy.choose(
          GARRISON.filter((stack) => stack.type === type).find((stack) => stack.held > 0) ??
            GARRISON.find((stack) => stack.type === type)!,
        )
      }
    />
    <div className="flex gap-2" role="group" aria-label="Tiers">
      {GARRISON.filter((stack) => stack.type === deploy.stack.type).map((stack) => (
        <StackButton key={painting(stack)} stack={stack} deploy={deploy} />
      ))}
    </div>
    <Amount deploy={deploy} />
  </div>
);

const OPTIONS = [
  {
    key: "A",
    name: "A · What you hold",
    rule: "Only the stacks the realm holds, highest tier first, as one row: the fewest things to read.",
    Body: HeldStacks,
  },
  {
    key: "B",
    name: "B · A column per troop",
    rule: "Every troop and tier always in the same place, an empty one dimmed: the hand learns where to click.",
    Body: TroopColumns,
  },
  {
    key: "C",
    name: "C · Troop, then tier",
    rule: "The troop as tabs, then its tiers: the narrowest, two clicks to change both.",
    Body: TroopTabs,
  },
] as const;

/** The six tiles around a realm a field army can step onto; two are taken. */
const DIRECTIONS = [
  { key: "NE", free: true },
  { key: "E", free: true },
  { key: "SE", free: false },
  { key: "SW", free: true },
  { key: "W", free: true },
  { key: "NW", free: false },
] as const;

/** The realm's guard slots, in the order an attacker meets them: two held, two open. */
const SLOTS: readonly ({ slot: number } & ({ held: Stack } | { held: null }))[] = [
  { slot: 4, held: null },
  { slot: 3, held: { type: "paladin", tier: 3, held: 120 } },
  { slot: 2, held: null },
  { slot: 1, held: { type: "knight", tier: 1, held: 800 } },
];

/** The map's picker: a small window hung on the tile, its one verb at its foot. */
const MapPicker = ({ Body }: { Body: (props: { deploy: Deploy }) => React.ReactNode }) => {
  const deploy = useDeploy(GARRISON[6]);
  return (
    <div className="w-[22.5rem]">
      <HudWindow
        title="Deploy field army"
        icon="military"
        onClose={() => undefined}
        actions={<DeployButton deploy={deploy} />}
      >
        <Body deploy={deploy} />
      </HudWindow>
    </div>
  );
};

/** The Military window's create-army form: a field army or a guard, where it goes, then the same choice. */
const MilitaryForm = ({ Body }: { Body: (props: { deploy: Deploy }) => React.ReactNode }) => {
  const deploy = useDeploy(GARRISON[6]);
  const [kind, setKind] = useState<"field" | "guard">("field");
  const [direction, setDirection] = useState<string>("NE");
  const [slot, setSlot] = useState(2);
  return (
    <div className="w-[30rem]">
      <HudWindow title="Military" icon="military" onClose={() => undefined} actions={<DeployButton deploy={deploy} />}>
        <div className="flex flex-col gap-4">
          <HudTabs
            tabs={[
              { key: "field", label: "Field army", count: 2 },
              { key: "guard", label: "Guard", count: 2 },
            ]}
            value={kind}
            onChange={setKind}
          />
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Where it goes">
            <span className="text-hud-label text-hud-muted">{kind === "field" ? "Steps out to" : "Guards slot"}</span>
            {kind === "field"
              ? DIRECTIONS.map(({ key, free }) => (
                  <HudButton
                    key={key}
                    kind="secondary"
                    size="sm"
                    disabled={!free}
                    aria-pressed={direction === key}
                    onClick={() => setDirection(key)}
                  >
                    {key}
                  </HudButton>
                ))
              : SLOTS.map(({ slot: number, held }) => (
                  <HudButton
                    key={number}
                    kind="secondary"
                    size="sm"
                    aria-pressed={slot === number}
                    onClick={() => setSlot(number)}
                  >
                    {number}
                    {held ? <HudTierChip tier={held.tier} /> : <HudChip>open</HudChip>}
                  </HudButton>
                ))}
          </div>
          <Body deploy={deploy} />
        </div>
      </HudWindow>
    </div>
  );
};

export const DeployOptionsSection = () => (
  <Element
    name="Deploy army (pick one)"
    wide
    rule="Three layouts, each as the map's picker and the Military window's form: the troop choice in sight, the amount with +500 and Max beside it, one Deploy with its cost, no Cancel beside the close."
    sheet={
      <div className="flex flex-col gap-8">
        {OPTIONS.map(({ key, name, rule, Body }) => (
          <div key={key} data-deploy-option={key} className="flex flex-col gap-3">
            <p data-lab-chrome className="text-sm text-white">
              <b>{name}</b> <span className="text-white/60">{rule}</span>
            </p>
            <div className="flex flex-wrap items-start gap-6">
              <MapPicker Body={Body} />
              <MilitaryForm Body={Body} />
            </div>
          </div>
        ))}
      </div>
    }
    today={
      <span className="text-sm text-white/70">
        Today: the map's picker (military/components/army-deployment-picker.tsx) and the Military window's form
        (unified-army-creation-modal) share the troop grid, TroopAmount with +500 and Max at the far right, and a
        footer; the window adds the army type toggle, the guard slots or the hex ring, and the cost in a note line.
      </span>
    }
  />
);
