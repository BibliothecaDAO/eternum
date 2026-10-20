import { type IconMeaning } from "@/ui/design-system/icon";
import { costLine } from "@/ui/design-system/kit/price-faces";
import {
  HudButton,
  HudCost,
  HudChip,
  HudDeploy,
  HudTabs,
  HudTierChip,
  type HudTroopStack,
  HudWindow,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import {
  type DeployTile,
  RealmHexDeployMap,
} from "@/ui/features/military/components/unified-army-creation-modal/realm-hex-deploy-map";
import { BiomeType, BiomeTypeToId, Direction, getNeighborHexes } from "@bibliothecadao/types";
import { useState } from "react";

import { Element } from "./sheet-element";

/**
 * The owner's pick in round 5: layout B, a column per troop. Drawn twice, as the map's picker (a tile beside the realm,
 * right-clicked) and as the Military window's create-army form, where the army goes stays today's map selector.
 */

type TroopType = "knight" | "crossbowman" | "paladin";

/** A realm's garrison: what each troop and tier holds. */
const GARRISON: readonly { type: TroopType; name: string; tiers: readonly [number, number, number] }[] = [
  { type: "knight", name: "Knights", tiers: [2_400, 600, 0] },
  { type: "crossbowman", name: "Crossbowmen", tiers: [1_200, 0, 0] },
  { type: "paladin", name: "Paladins", tiers: [900, 300, 120] },
];

const TROOPS = GARRISON.map(({ type, name, tiers }) => ({
  name,
  stacks: tiers.map(
    (held, at): HudTroopStack => ({
      key: `${type}-t${at + 1}`,
      icon: `${type}-t${at + 1}` as IconMeaning,
      tier: (at + 1) as 1 | 2 | 3,
      held,
    }),
  ),
}));
const stackOf = (key: string) => TROOPS.flatMap(({ stacks }) => stacks).find((stack) => stack.key === key)!;

/** How many fit in a new army (the realm's army room), and what one troop costs to field. */
const ROOM = 1_800;
const WHEAT_A_TROOP = 1;

const BIOME: Record<Direction, number> = {
  [Direction.EAST]: BiomeTypeToId[BiomeType.Grassland],
  [Direction.NORTH_EAST]: BiomeTypeToId[BiomeType.TemperateDeciduousForest],
  [Direction.NORTH_WEST]: BiomeTypeToId[BiomeType.Shrubland],
  [Direction.WEST]: BiomeTypeToId[BiomeType.Beach],
  [Direction.SOUTH_WEST]: BiomeTypeToId[BiomeType.Taiga],
  [Direction.SOUTH_EAST]: BiomeTypeToId[BiomeType.None],
};

/** The six tiles around the realm at (10, 10): four free, one taken, one not yet explored. */
export const DEPLOY_RING: readonly DeployTile[] = getNeighborHexes(10, 10).map(({ col, row, direction }) => ({
  col,
  row,
  direction,
  open: direction !== Direction.NORTH_WEST && direction !== Direction.SOUTH_EAST,
  explored: direction !== Direction.SOUTH_EAST,
  biome: BIOME[direction],
}));

/** One deploy's state: the stack chosen and how many go, kept within what fits. */
const useDeploy = () => {
  const [chosen, setChosen] = useState("paladin-t1");
  const [amount, setAmount] = useState(500);
  const most = Math.min(stackOf(chosen).held, ROOM);
  return {
    amount,
    body: (
      <HudDeploy
        troops={TROOPS}
        chosen={chosen}
        onChoose={(key) => {
          setChosen(key);
          setAmount(Math.min(amount, stackOf(key).held, ROOM));
        }}
        value={amount}
        most={most}
        onChange={setAmount}
      />
    ),
  };
};

/** The window's foot: what the deploy costs on the left, then the one verb, carrying its verb only. */
const DeployFoot = ({ amount }: { amount: number }) => (
  <HudWindowFoot note={<HudCost line={costLine([{ of: "wheat", amount: amount * WHEAT_A_TROOP }])} />}>
    <HudButton kind="primary" icon="military" disabled={amount === 0}>
      Deploy
    </HudButton>
  </HudWindowFoot>
);

/** The realm's guard slots, in the order an attacker meets them: two held, two open. */
const SLOTS = [
  { slot: 4, tier: null },
  { slot: 3, tier: 3 },
  { slot: 2, tier: null },
  { slot: 1, tier: 1 },
] as const;

/** The map's picker: a small window hung on the tile, its one verb at its foot. */
const MapPicker = () => {
  const deploy = useDeploy();
  return (
    <div className="w-[26rem]">
      <HudWindow title="Deploy field army" icon="military" onClose={() => undefined}>
        <DeployFoot amount={deploy.amount} />
        {deploy.body}
      </HudWindow>
    </div>
  );
};

/** The Military window's create-army form: a field army or a guard, where it goes, then the same choice. */
const MilitaryForm = () => {
  const deploy = useDeploy();
  const [kind, setKind] = useState<"field" | "guard">("field");
  const [direction, setDirection] = useState<Direction | null>(Direction.EAST);
  const [slot, setSlot] = useState(2);
  return (
    <div className="w-[30rem]">
      <HudWindow title="Military" icon="military" onClose={() => undefined}>
        <DeployFoot amount={deploy.amount} />
        <div className="flex flex-col gap-4">
          <HudTabs
            tabs={[
              { key: "field", label: "Field army", count: 2 },
              { key: "guard", label: "Guard", count: 2 },
            ]}
            value={kind}
            onChange={setKind}
          />
          {kind === "field" ? (
            <RealmHexDeployMap
              centerCol={10}
              centerRow={10}
              ring={DEPLOY_RING}
              selectedDirection={direction}
              onSelect={setDirection}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Guard slot">
              {SLOTS.map(({ slot: number, tier }) => (
                <HudButton
                  key={number}
                  kind="secondary"
                  size="sm"
                  aria-pressed={slot === number}
                  onClick={() => setSlot(number)}
                >
                  {number}
                  {tier ? <HudTierChip tier={tier} /> : <HudChip>open</HudChip>}
                </HudButton>
              ))}
            </div>
          )}
          {deploy.body}
        </div>
      </HudWindow>
    </div>
  );
};

export const DeploySection = () => (
  <Element
    name="Deploy army"
    wide
    rule="A column per troop, its tiers always in the same place, then the amount with +500 and Max beside it and a slider under it; one Deploy, its cost the line beside it in the foot. The Military window keeps its map selector for where the army steps out."
    sheet={
      <div data-deploy className="flex flex-wrap items-start gap-6">
        <MapPicker />
        <MilitaryForm />
      </div>
    }
    today={
      <span className="text-sm text-white/70">
        Today: the map's picker (military/components/army-deployment-picker.tsx) and the Military window's form
        (unified-army-creation-modal) share the troop grid, TroopAmount with +500 and Max at the far right and its
        slider under them, and a footer; the window adds the army type toggle, the guard slots or the hex map, and the
        cost in a note line.
      </span>
    }
  />
);
