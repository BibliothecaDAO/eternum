import { SKILL_POINT_RANKS, type SkillPointChoice, type SkillPointRank } from "@bibliothecadao/eternum";
import { structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import { formatExact, formatShort, StructureType } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudMeter,
  HudPortrait,
  HudStamina,
  HudTier,
  HudTierStep,
} from "@/ui/design-system/kit/hud-elements";
import { ARMY_DETAIL, BACK, RESEARCH_TREE, tierNumeral, TROOPS, UPGRADING, XP } from "@/ui/design-system/kit/words";
import { type ReactNode, useState } from "react";

import { FullIn } from "../full-in";
import type { ArmyView, AttributeKey, AttributeView, ScoutKind } from "./army-detail";

const KINDS: { key: ScoutKind; icon: IconMeaning }[] = [
  { key: "camp", icon: structureMeaning(StructureType.Camp, "frontier") },
  { key: "rift", icon: structureMeaning(StructureType.Rift, "frontier") },
  { key: "beasts", icon: structureMeaning(StructureType.Beasts, "frontier") },
];

/**
 * An army's detail (the owner's picks, 20 and 22 October), in two steps in one place. First its status, beside its
 * portrait in two rows: its troops, what each tile explored sends home and the refill, then its stamina line; its four attributes
 * as tiles (each its tier and what it gives, a press
 * opening its level-up); its XP with how XP is earned on its hover, and Level up: the primary once a held point fits a level,
 * else a way to see the next ranks. Level up turns the same place to the four choices, each with what it gives next
 * and its point, Scouting's kind, and the verb, with a way back.
 */
export const ArmyDetail = ({
  army,
  refill,
  sending,
  choosing = false,
  onLevelUp,
}: {
  army: ArmyView;
  /** The refill's control, at the end of the chips' row, so the stamina line keeps its width. */
  refill?: ReactNode;
  sending: boolean;
  /** Opens on the choices (the lab's second step). */
  choosing?: boolean;
  onLevelUp: (choice: SkillPointChoice) => unknown;
}) => {
  const [open, setOpen] = useState(choosing);
  const [chosen, setChosen] = useState<AttributeKey | "stamina">(() => firstChoice(army));
  const [kind, setKind] = useState<ScoutKind>("camp");
  const [staminaRank, setStaminaRank] = useState<SkillPointRank>(army.staminaPoints[0]?.rank ?? 1);
  const pick = army.attributes.find(({ key }) => key === chosen);
  const stamina = army.staminaPoints.find(({ rank }) => rank === staminaRank) ?? army.staminaPoints[0];
  const point = chosen === "stamina" ? stamina?.rank : pick?.next?.point;
  const gained = chosen === "stamina" ? (stamina?.refill ?? 0) : (pick?.next?.refill ?? 0);
  const canSpend = point !== undefined && (chosen !== "stamina" || gained > 0);
  const submit = () => {
    if (!canSpend || point === undefined) return;
    const kinds = { camp: "Camp", rift: "Rift", beasts: "Beasts" } as const;
    const sides = { battle: "Battle", logistics: "Logistics", homecoming: "Homecoming" } as const;
    return onLevelUp(
      chosen === "stamina"
        ? { kind: "Stamina", value: point }
        : chosen === "scouting"
          ? { kind: "Scouting", value: { kind: kinds[kind], value: undefined } }
          : { kind: sides[chosen], value: undefined },
    );
  };
  if (open)
    return (
      <div data-army-step="choose" className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between gap-2">
          <HudButton kind="quiet" size="sm" icon="arrow-left" onClick={() => setOpen(false)}>
            {BACK}
          </HudButton>
          <XpLine army={army} />
        </div>
        {army.attributes.map((attribute) => (
          <Choice
            key={attribute.key}
            attribute={attribute}
            chosen={chosen === attribute.key}
            onChoose={() => setChosen(attribute.key)}
          />
        ))}
        <button
          type="button"
          data-attribute="stamina"
          aria-pressed={chosen === "stamina"}
          onClick={() => setChosen("stamina")}
          className={cn(
            "flex items-center gap-2 rounded-md border px-2 py-2 text-left",
            chosen === "stamina" ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line hover:bg-hud-hover",
          )}
        >
          <Icon name="stamina" size={32} />
          <span className="flex-1 text-hud-strong text-hud-ink">Stamina</span>
          <span className="text-hud-label text-hud-good">+{stamina?.refill ?? 0}</span>
        </button>
        {chosen === "scouting" && pick?.next && <KindChoice kind={kind} onKind={setKind} />}
        {chosen === "stamina" && (
          <div className="flex gap-2" role="group" aria-label="Point to spend">
            {army.staminaPoints.map(({ rank, count }) => (
              <button
                key={rank}
                type="button"
                aria-label={`Spend ${tierNumeral(rank)} point`}
                aria-pressed={stamina?.rank === rank}
                onClick={() => setStaminaRank(rank)}
                className={cn(
                  "flex items-center gap-1 rounded border p-2",
                  stamina?.rank === rank ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line",
                )}
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
        <HudPortrait icon={army.art} label={TROOPS} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-center gap-2">
            <StatusChips army={army} />
            {refill && <span className="ml-auto flex">{refill}</span>}
          </span>
          <StaminaLine army={army} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {army.attributes.map((attribute) => (
          <AttributeTile key={attribute.key} attribute={attribute} onOpen={() => choose(attribute.key)} />
        ))}
      </div>
      <XpBlock army={army} onLevelUp={() => setOpen(true)} />
    </div>
  );
};

/** Over the stamina line: the army's troops, and what each tile explored sends home (none where reveals pay none). */
const StatusChips = ({ army }: { army: ArmyView }) => (
  <span className="flex flex-wrap items-center gap-1.5">
    <HudChip icons={["troops"]} label={TROOPS}>
      {formatShort(army.troops)}
    </HudChip>
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
const StaminaLine = ({ army }: { army: ArmyView }) => (
  <span data-stamina-line className="flex items-center gap-2">
    <span className="flex items-center gap-0.5 whitespace-nowrap text-hud-label tabular-nums text-hud-ink">
      <Icon name="stamina" size={14} />
      {`${formatExact(army.stamina.current)}/${formatExact(army.stamina.max)}`}
    </span>
    <span className="min-w-0 flex-1">
      <HudStamina stamina={army.stamina} />
    </span>
    {army.secondsToFull !== undefined && army.secondsToFull > 0 && <FullIn seconds={army.secondsToFull} />}
  </span>
);

/**
 * An attribute as a tile: its mark filling the frame, its name, its tier and what it gives; its hover says what
 * its next tier gives and costs, and a press opens its level-up.
 */
const AttributeTile = ({ attribute, onOpen }: { attribute: AttributeView; onOpen: () => void }) => (
  <button
    type="button"
    aria-label={`${attribute.name} ${attribute.now}`}
    data-tip={
      attribute.next
        ? `${tierNumeral(attribute.next.tier)}: ${attribute.next.change}`
        : ARMY_DETAIL.legendary(attribute.name)
    }
    onClick={onOpen}
    className="flex min-w-0 flex-col items-center gap-1 rounded-md border border-hud-line bg-hud-well px-1 py-2 hover:bg-hud-hover"
  >
    <Icon name={attribute.mark} size={40} />
    <span className="text-hud-label text-hud-ink">{attribute.name}</span>
    <HudTier tier={attribute.level} />
    <span className="text-center text-hud-label tabular-nums text-hud-good">{attribute.now}</span>
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

const XpBlock = ({ army, onLevelUp }: { army: ArmyView; onLevelUp: () => void }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2">
      <div className="flex gap-2" role="group" aria-label="Skill points">
        {SKILL_POINT_RANKS.map((rank) => (
          <span
            key={rank}
            className="flex items-center gap-0.5 text-hud-label tabular-nums"
            aria-label={`${tierNumeral(rank)} points: ${army.points[rank - 1]}`}
          >
            <HudTier tier={rank} />
            <span>{army.points[rank - 1]}</span>
          </span>
        ))}
      </div>
      <HudButton kind={army.available > 0 ? "primary" : "secondary"} size="sm" icon="upgrade" onClick={onLevelUp}>
        {ARMY_DETAIL.levelUp}
      </HudButton>
    </div>
    <XpLine army={army} />
    <HudMeter share={army.goal.share} label={XP} />
  </div>
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
      "flex items-center gap-2 rounded-md border px-2 py-2 text-left",
      chosen ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line hover:bg-hud-hover",
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
const KindChoice = ({ kind, onKind }: { kind: ScoutKind; onKind: (kind: ScoutKind) => void }) => (
  <div className="grid grid-cols-3 gap-2">
    {KINDS.map((option) => (
      <button
        key={option.key}
        type="button"
        aria-pressed={kind === option.key}
        onClick={() => onKind(option.key)}
        className={cn(
          "flex items-center justify-center gap-1 rounded-md border py-1.5 text-hud-body",
          kind === option.key ? "border-hud-line-strong bg-hud-chosen text-hud-ink" : "border-hud-line text-hud-muted",
        )}
      >
        <Icon name={option.icon} size={22} />
        {RESEARCH_TREE.kinds[option.key]}
      </button>
    ))}
  </div>
);
