import { Pin, Plate } from "@/three/map-plates/map-plates";
import type { ArmyPlate, StructurePlate } from "@/three/map-plates/map-plate-model";
import { siteName } from "@/three/map-plates/site-name";
import { Icon } from "@/ui/design-system/icon";
import { HudBubble, HudMenu, HudTierChip, HudTip } from "@/ui/design-system/kit/hud-elements";
import { orderTip } from "@/ui/features/frontier/hud/order-tip";
import { ActionType } from "@bibliothecadao/eternum";
import type { ReactNode } from "react";

import { Element } from "./sheet-element";

/**
 * The owner's round 4: "we also need a style sheet for all contextual elements on the map, fold it into the hud". Every
 * element the game draws on the map itself, at the moment it appears, on a stand-in for the map: the same tokens and
 * elements as the rest of the sheet. world's map overlay study (hex highlights, paths, ownership colours) joins here.
 */

const REALM: StructurePlate = {
  kind: "structure",
  relation: "own",
  owner: "djizus",
  name: "Sangsang",
  named: true,
  guards: [
    { type: "knight", tier: 1, count: 800 },
    { type: "paladin", tier: 3, count: 120 },
  ],
  arrivals: [{ troops: { type: "paladin", tier: 2, count: 300 }, secondsLeft: 780 }],
  icon: "realm",
};
const ENEMY_ARMY: ArmyPlate = {
  kind: "army",
  relation: "enemy",
  owner: "Moonhand",
  homeName: "Xeswet",
  troops: { type: "paladin", tier: 3, count: 300 },
  stamina: { current: 84, max: 150 },
};
const CAMP: StructurePlate = {
  kind: "structure",
  relation: "neutral",
  owner: "The Vanguard",
  name: "Camp",
  named: false,
  place: siteName(7 * 2 ** 32 + 41),
  reward: "640 Labor",
  guards: [{ type: "crossbowman", tier: 1, count: 250 }],
  arrivals: [],
  icon: "camp",
};

const step = (actionType: ActionType, staminaCost?: number) => ({ hex: { col: 0, row: 0 }, actionType, staminaCost });
/** The order line as the game writes it (orderTip), for an order or a refusal. */
const line = (order: Partial<Parameters<typeof orderTip>[0]>) => {
  const tip = orderTip({
    path: undefined,
    target: null,
    exploreStamina: 30,
    food: { wheat: 0, fish: 0 },
    explored: true,
    refusal: undefined,
    staminaWait: undefined,
    points: { exploreTile: 0, openRelicCrate: 250 },
    clickPreviews: false,
    ...order,
  });
  return tip ? <HudTip line={tip.line} how={tip.gestures ?? undefined} /> : null;
};

/** A plate as the plate layer places it, standing in the page. */
const PlateAt = ({
  plate,
  open = false,
  selected = false,
}: {
  plate: StructurePlate | ArmyPlate;
  open?: boolean;
  selected?: boolean;
}) => (
  <div className="mp !static !overflow-visible">
    <div className="mp-at !static" data-relation={plate.relation} data-selected={selected}>
      <Plate plate={plate} open={open} />
    </div>
  </div>
);

/** A stand-in for the map under one element: the lore's mist, darkened as the world map is under the HUD. */
const OnMap = ({ name, when, children }: { name: string; when: string; children: ReactNode }) => (
  <figure data-map-context={name} className="flex flex-col gap-2">
    <div className="relative isolate flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-white/10 p-4">
      <img
        src="/images/landscapes/frontier-mist-800.webp"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover opacity-30 brightness-50"
      />
      <div className="flex flex-col items-center gap-2">{children}</div>
    </div>
    <figcaption data-lab-chrome className="text-sm text-white">
      <b>{name}</b> <span className="text-white/60">{when}</span>
    </figcaption>
  </figure>
);

/** Troops on their way to a tile, drawn on the tile they reach: their troops and when. */
const ArrivalMarker = () => (
  <span className="ui ui-pill" role="img" aria-label="Arriving: 300 Paladins T2 in 13 minutes">
    <Icon name="paladin-t2" size={18} />
    <HudTierChip tier={2} />
    <span className="text-hud-strong">300</span>
    <span className="text-hud-label text-hud-cue">13m</span>
  </span>
);

export const MapContextSection = () => (
  <Element
    name="Map context"
    wide
    rule="Everything drawn on the map itself, at the moment it appears: the same tokens and elements as the rest of the HUD. A right-click acts; nothing here asks for an extra click."
    sheet={
      <div className="grid grid-cols-3 gap-4">
        <OnMap
          name="Action bubbles"
          when="Around the selected realm or army: its orders as bubbles, a count to act on as a badge."
        >
          <PlateAt plate={REALM} selected />
          <div className="flex gap-3">
            <HudBubble icon="military" word="Military" count={2} />
            <HudBubble icon="transfer" word="Transfer" />
            <HudBubble icon="build" word="Build" />
          </div>
        </OnMap>
        <OnMap
          name="Plates"
          when="Over every realm, army, camp and rift: two rows at rest, the rest on hover (the hover card)."
        >
          <div className="flex items-end gap-3">
            <PlateAt plate={CAMP} />
            <PlateAt plate={CAMP} open />
          </div>
          <div className="flex items-end gap-3">
            <PlateAt plate={ENEMY_ARMY} />
            <PlateAt plate={ENEMY_ARMY} open />
            <div className="mp !static">
              <div className="mp-at !static" data-relation="enemy">
                <Pin plate={ENEMY_ARMY} />
              </div>
            </div>
          </div>
        </OnMap>
        <OnMap
          name="Order line"
          when="Under the hovered tile while an army is selected: the right-click's order, its cost and payoff."
        >
          {line({ path: [step(ActionType.Move), step(ActionType.Explore)], food: { wheat: 50, fish: 0 } })}
          {line({ path: [step(ActionType.Move), step(ActionType.Attack, 50)], target: CAMP.place })}
          {line({ path: [step(ActionType.Move), step(ActionType.Help)] })}
        </OnMap>
        <OnMap name="Refusals" when="The same line where no order leads: why, and when it will, to the second.">
          {line({ refusal: { reason: "stamina", need: 30 }, staminaWait: 24 })}
          {line({ refusal: { reason: "too-far" } })}
          {line({ explored: false })}
        </OnMap>
        <OnMap name="Crate and spire" when="Beside a relic crate or a spire: the right-click opens or travels.">
          {line({ path: [step(ActionType.Move), step(ActionType.Chest)] })}
          {line({ path: [step(ActionType.Move), step(ActionType.SpireTravel)] })}
        </OnMap>
        <OnMap name="Structure menu" when="A right-click on your own realm: what it can raise, one click each.">
          <HudMenu
            items={[
              { label: "Create Attack Army", icon: "military" },
              { label: "Create Defense Army", icon: "defend" },
            ]}
          />
        </OnMap>
        <OnMap
          name="Deploy picker"
          when="A right-click on a tile beside your realm: the Deploy army layout picked above, hung on the tile."
        >
          <HudTip line="Deploy an army here" how="Right-click" />
        </OnMap>
        <OnMap
          name="Arrivals"
          when="On the tile troops are marching to: what arrives and when; the realm's plate says it on hover too."
        >
          <ArrivalMarker />
          <PlateAt plate={REALM} open />
        </OnMap>
        <OnMap
          name="Hex highlights, paths, ownership"
          when="world's map overlay study: the tiles an order reaches, the path it takes, whose land it is. It joins here."
        >
          <span data-lab-chrome className="max-w-xs text-center text-sm text-white/70">
            world's study lands here, on these tokens: each order's highlight in the action colours, the path in the
            accent, ownership in the side colours (own, ally, enemy, neutral).
          </span>
        </OnMap>
      </div>
    }
    today={
      <span className="text-sm text-white/70">
        Today: bubbles (world/hud/action-bubbles.tsx, CircleButton), plates (three/map-plates), the order line
        (three/scenes/worldmap-order-tip.tsx), the structure menu (three/scenes/context-menu, its own look), the deploy
        picker (military/components/army-deployment-picker.tsx), arrivals only inside panels (incoming-caravans.tsx).
        Each is styled on its own; here they share the sheet.
      </span>
    }
  />
);
