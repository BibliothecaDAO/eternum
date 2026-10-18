import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import type { Price } from "../hud-prices";
import { HudButton, HudCard, HudChip, HudRarity, HudSheet } from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { chooseOne, RESEARCH, UPGRADE, UPGRADING } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { hudPrices } from "../hud-prices";
import { RefusedUpgrade } from "./refused-upgrade";

/** One side of a tier's choice: its art and name, and what it gives every building of the type, before → after. */
type Side = { icon: IconMeaning; name: string; gain: { icon: IconMeaning; label: string; value: string } };

/** One figure of the building as it stands: its icons, its number, and the name its tooltip says. */
export type Figure = { icons: IconMeaning[]; label: string; value: string };

/** What a building is doing now, as chips: icons and numbers on the surface, each named when asked. */
export const Figures = ({ figures }: { figures: readonly Figure[] }) => (
  <div className="flex flex-wrap items-center justify-center gap-1.5">
    {figures.map((figure) => (
      <HudChip key={figure.label} icons={figure.icons} label={figure.label}>
        {figure.value}
      </HudChip>
    ))}
  </div>
);

/**
 * A building type's Upgrade sheet (wireframes 02 and 09): one sheet whichever way the player came, a building on the
 * board or its row in the castle's tree. What the building does now (what each makes an hour, how many stand, what
 * its store holds, the population it takes), then the type, its tier now and next on their framed chips, then its two sides
 * (farm, workshop, barracks) with what each gives every building of the type, the first tap lifting one, or what the
 * tier gives where there is no choice; then the seal (the choice is final for the season) and Upgrade carrying its
 * Essence and labor. Upgrade always ends the sheet: while it cannot run it stays, dimmed, with its price, over the one
 * line that says why (a side still to choose, or what the realm needs against what it holds) and the fix where there is
 * one. Opened from the board, its head leads to Research, where every type's row stands. At legendary there is nothing
 * next.
 */
export const TypeUpgradeSheet = ({
  icon,
  name,
  now,
  tier,
  sides,
  lifted,
  onLift,
  gives,
  prices,
  refusal,
  sending,
  onUpgrade,
  onResearch,
  onClose,
}: {
  icon: IconMeaning;
  name: string;
  /** What the building does as it stands. */
  now?: readonly Figure[];
  tier: Tier;
  sides?: readonly [Side, Side];
  lifted?: 0 | 1;
  onLift?: (side: 0 | 1) => void;
  /** What the next tier gives where there is no choice (a hut's population; a training building's next army). */
  gives?: ReactNode;
  prices: readonly Price[];
  /** Why Upgrade cannot run with a side chosen (or with no choice to make): what the realm is short of. */
  refusal?: Refusal;
  sending: boolean;
  onUpgrade: () => void;
  /** Opens Research; absent when the sheet opened from there. */
  onResearch?: () => void;
  onClose: () => void;
}) => {
  const top = tier === 5;
  // A tier with two sides waits for one to be lifted: the choice is final for the season.
  const waits: Refusal | undefined =
    sides && lifted === undefined
      ? { reason: { kind: "failed", line: chooseOne(sides[0].name, sides[1].name) } }
      : refusal;
  return (
    <HudSheet label={name} onClose={onClose}>
      <div className="flex items-center gap-2.5">
        <SemanticIcon name={icon} size={30} />
        {onResearch && (
          <HudButton kind="secondary" size="sm" icon="research" onClick={onResearch}>
            {RESEARCH}
          </HudButton>
        )}
      </div>
      {now && now.length > 0 && <Figures figures={now} />}
      <div className="flex items-center justify-center gap-2">
        <HudRarity tier={tier} word />
        {!top && (
          <>
            <span aria-hidden className="text-hud-muted">
              →
            </span>
            <HudRarity tier={(tier + 1) as Tier} word />
          </>
        )}
        {top && <SemanticIcon name="check" size={22} />}
      </div>
      {!top && gives}
      {!top && sides && (
        <div role="group" aria-label={chooseOne(sides[0].name, sides[1].name)} className="grid grid-cols-2 gap-2">
          {sides.map((side, index) => (
            <SideCard key={side.name} side={side} lifted={lifted === index} onLift={() => onLift?.(index as 0 | 1)} />
          ))}
        </div>
      )}
      {!top &&
        (waits ? (
          <RefusedUpgrade word={UPGRADE} prices={prices} refusal={waits} />
        ) : (
          <div className="flex items-center gap-2">
            {sides && <SemanticIcon name="final-seal" size={26} />}
            <span className="grid flex-1">
              <HudButton
                kind="primary"
                prices={hudPrices(prices)}
                busy={sending ? UPGRADING : undefined}
                onClick={onUpgrade}
              >
                {UPGRADE}
              </HudButton>
            </span>
          </div>
        ))}
    </HudSheet>
  );
};

/** A side of the choice: its art and name, and what it gives every building of the type; pressed when chosen. */
const SideCard = ({ side, lifted, onLift }: { side: Side; lifted: boolean; onLift: () => void }) => (
  <HudCard
    title={side.name}
    picture={<SemanticIcon name={side.icon} size={30} />}
    detail={
      <HudChip icons={[side.gain.icon]} label={side.gain.label}>
        {side.gain.value}
      </HudChip>
    }
    selected={lifted}
    onClick={onLift}
  />
);
