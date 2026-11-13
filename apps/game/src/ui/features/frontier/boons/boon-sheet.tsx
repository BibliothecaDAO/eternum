import { Icon } from "@/ui/design-system/icon";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudChip, HudSheet, HudTier, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { BOON_WORDS } from "@/ui/design-system/kit/words";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatShort } from "@bibliothecadao/types";

import { BOON_STEPS, BOONS, type BoonKind } from "./boon-catalog";
import { armyBoons, type BoonCard, type BoonFacts, type BoonSheetPlan } from "./boon-sheet-plan";

/** What the player picks on a sheet: one of its boons, or rest. */
export type BoonPick = BoonKind | "rest";

/**
 * A skill point's sheet (U16): its rank, then a card from each of the army's three givers, each with the giver's Order
 * crest and name, the boon, its steps before and after and what it then does; then Rest. A tap on a card takes it; the
 * next point waiting opens on the same sheet, one pick after the other.
 */
export const BoonSheet = ({
  plan,
  busy,
  onPick,
  onClose,
}: {
  plan: BoonSheetPlan;
  /** A pick on its way: the cards wait for it. */
  busy?: boolean;
  onPick: (pick: BoonPick) => void;
  onClose: () => void;
}) => (
  <HudSheet label={BOON_WORDS.title} onClose={onClose}>
    <div className="flex items-center gap-2">
      <HudTier tier={plan.rank} />
      <span className="text-hud-strong text-hud-ink">{BOON_WORDS.choose}</span>
    </div>
    <div data-boon-cards className="grid grid-cols-3 gap-1.5">
      {plan.cards.map((card) => (
        <BoonCardButton key={card.boon} card={card} disabled={busy} onTake={() => onPick(card.boon)} />
      ))}
    </div>
    {plan.waiting > 0 && <span className="text-hud-label text-hud-muted">{BOON_WORDS.waiting(plan.waiting)}</span>}
    <HudWindowFoot note={BOON_WORDS.restGives(plan.rest)}>
      <HudButton kind="secondary" icon="stamina" disabled={busy} onClick={() => onPick("rest")}>
        {BOON_WORDS.rest}
      </HudButton>
    </HudWindowFoot>
  </HudSheet>
);

/** One giver's card, the whole card one button: its crest and Order, the boon, its steps, what it then does. */
const BoonCardButton = ({ card, disabled, onTake }: { card: BoonCard; disabled?: boolean; onTake: () => void }) => (
  <button
    type="button"
    data-boon={card.boon}
    aria-label={`${BOON_WORDS.take} ${BOON_WORDS.names[card.boon]}`}
    disabled={disabled}
    onClick={onTake}
    className="ui-pick flex min-w-0 flex-col items-center gap-1 rounded-md border border-hud-line px-1 py-2 text-center hover:bg-hud-hover disabled:opacity-60"
  >
    <Icon name={orderMeaning(card.order)} size={40} />
    <span className="text-hud-label text-hud-muted">{card.orderName}</span>
    <span className="flex flex-col items-center text-hud-strong text-hud-ink">
      <Icon name={BOONS[card.boon].icon} size={20} />
      {BOON_WORDS.names[card.boon]}
    </span>
    <StepPips from={card.from} to={card.to} />
    <span className="text-hud-label text-hud-good">{card.effect}</span>
    {card.stamina > 0 && <span className="text-hud-label text-hud-muted">{BOON_WORDS.giveBack(card.stamina)}</span>}
  </button>
);

/** A boon's five steps: those it holds, those this card adds, those still open. */
const StepPips = ({ from, to }: { from: number; to: number }) => (
  <span role="img" aria-label={BOON_WORDS.steps(from, to)} className="flex gap-1">
    {Array.from({ length: BOON_STEPS }, (_, index) => (
      <span
        key={index}
        className={cn(
          "size-2.5 rounded-full border border-hud-line",
          index < from ? "bg-hud-gold" : index < to ? "bg-hud-good" : "bg-transparent",
        )}
      />
    ))}
  </span>
);

/** The army's boons for the day on its line: each boon held, with its steps. Nothing while it holds none. */
export const ArmyBoonsLine = ({ steps }: { steps: BoonFacts["steps"] }) => {
  const held = armyBoons(steps);
  if (held.length === 0) return null;
  return (
    <span data-army-boons className="flex flex-wrap items-center gap-1" role="group" aria-label={BOON_WORDS.boons}>
      {held.map(({ boon, steps: count }) => (
        <HudChip key={boon} icons={[BOONS[boon].icon]} label={BOON_WORDS.names[boon]}>
          {formatShort(count)}
        </HudChip>
      ))}
    </span>
  );
};
