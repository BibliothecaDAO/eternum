import { SKILL_POINT_RANKS, type SkillPointChoice, type SkillPointRank } from "@bibliothecadao/eternum";
import { EtherealMark } from "../hud/army-token";
import { formatDuration, formatExact, formatShort } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, IconGroup } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudMeter,
  HudPortrait,
  HudStamina,
  HudTier,
  HudTierStep,
  rankedTip,
} from "@/ui/design-system/kit/hud-elements";
import { ARMY_DETAIL, DEEP_WORDS, tierNumeral, TROOPS, UPGRADING, XP } from "@/ui/design-system/kit/words";
import { type ReactNode, useState } from "react";

import { FullIn } from "../full-in";
import { useOpens } from "../opening/use-opening";
import type { ArmyView, AttributeKey, AttributeView, ScoutKind } from "./army-detail";

import { pointChoices, scoutingChoices } from "../progression-choices";

/** Where an army's panel stands: its status, or its level-up choices. */
interface ArmyStep {
  choosing: boolean;
  choose: (choosing: boolean) => void;
}

/**
 * The step an army's panel stands on, held by whoever draws its frame, so the frame's head (the army's trash) and the
 * panel read one step. It opens on the choices when asked (a phone's Level up beside the picked army), and returns to
 * the status once the army's last point is spent.
 */
export const useArmyStep = (available: number, choosing = false): ArmyStep => {
  const [open, setOpen] = useState(choosing);
  const [held, setHeld] = useState(available);
  if (held !== available) {
    setHeld(available);
    if (available === 0) setOpen(false);
  }
  return { choosing: open, choose: setOpen };
};

/**
 * An army's detail (the owner's picks, 20 and 22 October; its layout B', 4 November), in two steps in one place. First
 * its status, beside its portrait in two rows: its troops and what each tile explored sends home, then its stamina line,
 * the two ways to a full bar at its right end, the refill's price over when it is full; its four attributes as a 2×2
 * list (each its tier and what it gives, a press opening its level-up); its XP, the points it holds and Level up: the
 * primary once a held point fits a level, else a way to see the next ranks. Level up turns the same place to the four
 * choices, each with what it gives next and its point, Scouting's kind, and the verb; the sheet's cross closes it, and
 * the army opens again on its status (no Back: the owner's pick A, 2 November 2026). Once the army's last point is spent
 * the choices have nothing left to buy, so the place returns to the status.
 */
export const ArmyDetail = ({
  army,
  refill,
  sending,
  step,
  onLevelUp,
}: {
  army: ArmyView;
  /** The refill's control, at the chips' row's end over "Full in" (pay or wait); the stamina line keeps its width. */
  refill?: ReactNode;
  sending: boolean;
  /** The step it stands on, held by whoever draws its frame (useArmyStep), so the frame's head shows what fits it. */
  step: ArmyStep;
  onLevelUp: (choice: SkillPointChoice) => unknown;
}) => {
  const { choosing: open, choose: setOpen } = step;
  const showsXp = useOpens("army-xp");
  const [chosen, setChosen] = useState<AttributeKey | "stamina">(() => firstChoice(army));
  const [kind, setKind] = useState<ScoutKind>("camp");
  const [staminaRank, setStaminaRank] = useState<SkillPointRank>(army.staminaPoints[0]?.rank ?? 1);
  const pick = army.attributes.find(({ key }) => key === chosen);
  const stamina = army.staminaPoints.find(({ rank }) => rank === staminaRank) ?? army.staminaPoints[0];
  const point = chosen === "stamina" ? stamina?.rank : pick?.next?.point;
  const gained = chosen === "stamina" ? (stamina?.refill ?? 0) : (pick?.next?.refill ?? 0);
  const canSpend =
    point !== undefined &&
    (chosen !== "stamina" || gained > 0) &&
    (chosen !== "scouting" || army.scoutingKinds.includes(kind));
  const submit = () => {
    if (!canSpend || point === undefined) return;
    const option = pointChoices.find(({ key }) => key === chosen)!;
    return onLevelUp(option.choice(scoutingChoices.find((option) => option.key === kind)!.choice, point));
  };
  if (open)
    return (
      <div data-army-step="choose" className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-end gap-2">
          <XpLine army={army} />
        </div>
        {pointChoices.map((option) =>
          option.key === "stamina" ? (
            <button
              key={option.key}
              type="button"
              data-attribute="stamina"
              aria-pressed={chosen === "stamina"}
              onClick={() => setChosen("stamina")}
              className={cn(
                "ui-pick flex items-center gap-2 rounded-md border border-hud-line px-2 py-2 text-left",
                chosen !== "stamina" && "hover:bg-hud-hover",
              )}
            >
              <Icon name={option.mark} size={32} />
              <span className="flex-1 text-hud-strong text-hud-ink">{option.name}</span>
              <span className="text-hud-label text-hud-good">+{stamina?.refill ?? 0}</span>
            </button>
          ) : (
            <Choice
              key={option.key}
              attribute={army.attributes.find(({ key }) => key === option.key)!}
              chosen={chosen === option.key}
              onChoose={() => setChosen(option.key)}
            />
          ),
        )}
        {chosen === "scouting" && pick?.next && (
          <KindChoice kind={kind} available={army.scoutingKinds} onKind={setKind} />
        )}
        {chosen === "stamina" && (
          <div className="flex gap-2" role="group" aria-label="Point to spend">
            {army.staminaPoints.map(({ rank, count }) => (
              <button
                key={rank}
                type="button"
                aria-label={`Spend ${tierNumeral(rank)} point`}
                aria-pressed={stamina?.rank === rank}
                onClick={() => setStaminaRank(rank)}
                className={cn("ui-pick flex items-center gap-1 rounded border border-hud-line p-2")}
              >
                <HudTier tier={rank} />
                <span>×{count}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-hud-divider pt-3">
          <span className="flex flex-1 items-center gap-2 text-hud-label text-hud-ink">
            {point !== undefined ? (
              <>
                <HudTier tier={point} />
                <Icon name="stamina" size={16} />+{gained}
              </>
            ) : (
              "No fitting point"
            )}
          </span>
          <HudButton kind="primary" disabled={!canSpend} busy={sending ? UPGRADING : undefined} onClick={submit}>
            {chosen === "stamina" ? "Refill" : ARMY_DETAIL.levelUp}
          </HudButton>
        </div>
      </div>
    );
  const choose = (attribute: AttributeKey) => {
    setChosen(attribute);
    setOpen(true);
  };
  return (
    <div data-army-step="stats" className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <HudPortrait icon={army.art} label={TROOPS} />
          <EtherealMark layer={army.ethereal} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-center gap-2">
            <StatusChips army={army} />
            {refill && <span className="ml-auto flex">{refill}</span>}
          </span>
          <StaminaLine stamina={army.stamina} secondsToFull={army.secondsToFull} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {army.attributes.map((attribute) => (
          <AttributeRow key={attribute.key} attribute={attribute} onOpen={() => choose(attribute.key)} />
        ))}
      </div>
      {showsXp && <XpBlock army={army} onLevelUp={() => setOpen(true)} />}
    </div>
  );
};

/**
 * Over the stamina line: the army's troops; in the Deep, how long they last (each tick takes its loss); and what each tile
 * explored sends home (none where reveals pay none).
 */
const StatusChips = ({ army }: { army: ArmyView }) => (
  <span className="flex flex-wrap items-center gap-1.5">
    <HudChip icons={["troops"]} label={TROOPS}>
      {formatShort(army.troops)}
    </HudChip>
    {army.deep && (
      <HudChip icons={["hourglass"]} label={DEEP_WORDS.inTheDeep}>
        {DEEP_WORDS.lasts(army.deep.left, formatDuration(army.deep.seconds, { days: false }))}
      </HudChip>
    )}
    {army.revealYield !== null && (
      <HudChip icons={["essence", "labor"]} label={ARMY_DETAIL.revealPaysLabel}>
        {army.revealYield === undefined ? "—" : ARMY_DETAIL.revealPays(formatShort(army.revealYield))}
      </HudChip>
    )}
  </span>
);

/**
 * The stamina on one line (the owner's layout A, 27 October): "96/170", the bar in a segment per explore, and when it is
 * full again.
 */
const StaminaLine = ({ stamina, secondsToFull }: Pick<ArmyView, "stamina" | "secondsToFull">) => (
  <span data-stamina-line className="flex items-center gap-2">
    <span className="flex items-center gap-0.5 whitespace-nowrap text-hud-label tabular-nums text-hud-ink">
      <Icon name="stamina" size={14} />
      {`${formatExact(stamina.current)}/${formatExact(stamina.max)}`}
    </span>
    <span className="min-w-0 flex-1">
      <HudStamina stamina={stamina} />
    </span>
    {secondsToFull !== undefined && secondsToFull > 0 && <FullIn seconds={secondsToFull} />}
  </span>
);

/**
 * An attribute as a row half the sheet wide: its mark, its name and tier over what it gives; its hover says what its
 * next tier gives and costs, and a press opens its level-up.
 */
const AttributeRow = ({ attribute, onOpen }: { attribute: AttributeView; onOpen: () => void }) => (
  <button
    type="button"
    aria-label={`${attribute.name} ${attribute.now}`}
    {...rankedTip(
      attribute.next
        ? [{ rank: attribute.next.tier }, `: ${attribute.next.change}`]
        : ARMY_DETAIL.legendary(attribute.name),
    )}
    onClick={onOpen}
    className="flex min-w-0 items-center gap-2 rounded-md border border-hud-line bg-hud-well px-2 py-1.5 text-left hover:bg-hud-hover"
  >
    <Icon name={attribute.mark} size={32} />
    <span className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1 text-hud-label text-hud-ink">
        {attribute.name}
        <HudTier tier={attribute.level} />
      </span>
      <span className="truncate text-hud-label tabular-nums text-hud-good">{attribute.now}</span>
    </span>
  </button>
);

const firstChoice = (army: ArmyView): AttributeKey | "stamina" =>
  army.attributes.find(({ next }) => next?.affordable)?.key ?? (army.available > 0 ? "stamina" : "battle");

const XpLine = ({ army }: { army: ArmyView }) => (
  <span className="flex items-center gap-1 text-hud-label tabular-nums text-hud-muted">
    {formatExact(army.xp)} / {formatExact(army.goal.at)} {XP}
    <HudTier tier={army.goal.rank} />
  </span>
);

/** The XP toward the next point, the points held beside Level up (only the ranks held), and the XP's meter. */
const XpBlock = ({ army, onLevelUp }: { army: ArmyView; onLevelUp: () => void }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <XpLine army={army} />
      <span className="ml-auto flex items-center gap-2">
        <HeldPoints points={army.points} />
        <LevelUpButton affordable={army.available > 0} onPress={onLevelUp} />
      </span>
    </div>
    <HudMeter share={army.goal.share} label={XP} />
  </div>
);

/** The skill points held, only the ranks held: nothing at all while none is. */
const HeldPoints = ({ points }: { points: readonly number[] }) => (
  <span className="flex items-center gap-2" role="group" aria-label="Skill points">
    {SKILL_POINT_RANKS.filter((rank) => points[rank - 1]! > 0).map((rank) => (
      <span
        key={rank}
        className="flex items-center gap-0.5 text-hud-label tabular-nums text-hud-ink"
        aria-label={`${tierNumeral(rank)} points: ${points[rank - 1]}`}
      >
        <HudTier tier={rank} />×{points[rank - 1]}
      </span>
    ))}
  </span>
);

/**
 * The shared level-up control for the army card and picked row: primary when a skill point can be spent,
 * otherwise a way to browse the choices.
 */
export const LevelUpButton = ({ affordable, onPress }: { affordable: boolean; onPress: () => void }) => (
  <HudButton kind={affordable ? "primary" : "secondary"} size="sm" icon="upgrade" onClick={onPress}>
    {affordable ? ARMY_DETAIL.levelUp : ARMY_DETAIL.levelUps}
  </HudButton>
);

/** One level-up: the attribute, its next level, what it gives next, its point. */
const Choice = ({
  attribute,
  chosen,
  onChoose,
}: {
  attribute: AttributeView;
  chosen: boolean;
  onChoose: () => void;
}) => (
  <button
    type="button"
    aria-pressed={chosen}
    data-attribute={attribute.key}
    onClick={onChoose}
    className={cn(
      "ui-pick flex items-center gap-2 rounded-md border border-hud-line px-2 py-2 text-left",
      !chosen && "hover:bg-hud-hover",
    )}
  >
    <Icon name={attribute.mark} size={32} />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex items-center gap-1.5 text-hud-strong text-hud-ink">
        {attribute.next ? (
          <>
            {attribute.name}
            <HudTierStep from={attribute.level} to={attribute.next.tier} />
          </>
        ) : (
          ARMY_DETAIL.legendary(attribute.name)
        )}
      </span>
      <span className="text-hud-label tabular-nums text-hud-good">{attribute.next?.change ?? attribute.now}</span>
    </span>
    {attribute.next?.point !== undefined && <HudTier tier={attribute.next.point} />}
  </button>
);

/** Scouting's kind: the sites its new level finds more of. */
const KindChoice = ({
  kind,
  available,
  onKind,
}: {
  kind: ScoutKind;
  available: readonly ScoutKind[];
  onKind: (kind: ScoutKind) => void;
}) => (
  <div className="flex gap-2">
    {scoutingChoices
      .filter((option) => available.includes(option.key))
      .map((option) => (
        <button
          key={option.key}
          type="button"
          data-scout-kind={option.key}
          aria-pressed={kind === option.key}
          onClick={() => onKind(option.key)}
          className={cn(
            "ui-pick flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-hud-line py-1.5 text-hud-body",
            kind === option.key ? "text-hud-ink" : "text-hud-muted",
          )}
        >
          <IconGroup name={option.icon} size={22} />
          {option.name}
        </button>
      ))}
  </div>
);
