import { structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import { StructureType } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudPortrait, HudTier } from "@/ui/design-system/kit/hud-elements";
import {
  ARMY_DETAIL,
  BACK,
  RESEARCH_TREE,
  STAMINA,
  TIER_WORDS,
  TROOPS,
  UPGRADING,
  XP,
} from "@/ui/design-system/kit/words";
import { formatAmount, formatExact, formatFigure } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";

import { FullIn } from "../full-in";
import type { ArmyView, AttributeKey, AttributeView, ScoutKind } from "./army-detail";

const KINDS: { key: ScoutKind; icon: IconMeaning }[] = [
  { key: "camp", icon: structureMeaning(StructureType.Camp, "frontier") },
  { key: "rift", icon: structureMeaning(StructureType.Rift, "frontier") },
  { key: "beasts", icon: structureMeaning(StructureType.Beasts, "frontier") },
];

/**
 * An army's detail (the owner's picks, 20 and 22 October), in two steps in one place. First its status: its troops,
 * when its stamina is full again and what each tile explored sends home on one line over the stamina bar, with the
 * refill; its four attributes as tiles (each its tier and what it gives, a press opening its level-up); its XP with
 * how XP is earned on its hover, and Level up: the primary once the XP buys a level, else a way to see what it will
 * buy. Level up turns the same place to the four choices, each with what it gives next and its XP, Scouting's kind,
 * and the verb, with a way back.
 */
export const ArmyDetail = ({
  army,
  refill,
  sending,
  choosing = false,
  onLevelUp,
}: {
  army: ArmyView;
  /** The refill's control on the stamina row. */
  refill?: ReactNode;
  sending: boolean;
  /** Opens on the choices (the lab's second step). */
  choosing?: boolean;
  onLevelUp: (attribute: AttributeKey, kind: ScoutKind | undefined) => unknown;
}) => {
  const [open, setOpen] = useState(choosing);
  const [chosen, setChosen] = useState<AttributeKey>(() => firstChoice(army));
  const [kind, setKind] = useState<ScoutKind>("camp");
  const pick = army.attributes.find(({ key }) => key === chosen)!;
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
        {pick.key === "scouting" && pick.next && <KindChoice kind={kind} onKind={setKind} />}
        <LevelUpFoot
          army={army}
          chosen={pick}
          sending={sending}
          onLevelUp={() => onLevelUp(pick.key, pick.key === "scouting" ? kind : undefined)}
        />
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
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <StatusLine army={army} />
          <span className="flex w-full items-center gap-2 text-hud-label tabular-nums text-hud-muted">
            <Icon name="stamina" size={16} />
            <span className="min-w-16 flex-1">
              <HudMeter amount={army.stamina} tone="good" label={STAMINA} />
            </span>
            {`${formatExact(army.stamina.current)}/${formatExact(army.stamina.max)}`}
          </span>
        </div>
        {refill}
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

/**
 * Over the stamina bar, on one line (the owner, 22 October): the army's troops, when its stamina is full again, and what
 * each tile explored sends home (none in a game whose reveals pay none).
 */
const StatusLine = ({ army }: { army: ArmyView }) => (
  <span className="flex flex-wrap items-center gap-1.5">
    <HudChip icons={["troops"]} label={TROOPS}>
      {formatExact(army.troops)}
    </HudChip>
    {army.secondsToFull !== undefined && army.secondsToFull > 0 && <FullIn seconds={army.secondsToFull} />}
    {army.revealYield !== null && (
      <HudChip icons={["essence", "labor"]} label={ARMY_DETAIL.revealPaysLabel}>
        {army.revealYield === undefined ? "—" : ARMY_DETAIL.revealPays(formatAmount(army.revealYield))}
      </HudChip>
    )}
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
        ? ARMY_DETAIL.nextTier(attribute.next.word, attribute.next.change, formatExact(attribute.next.xp))
        : ARMY_DETAIL.legendary(attribute.name)
    }
    onClick={onOpen}
    className="flex min-w-0 flex-col items-center gap-1 rounded-md border border-hud-line bg-hud-well px-1 py-2 hover:bg-hud-hover"
  >
    <Icon name={attribute.mark} size={40} />
    <span className="text-hud-label text-hud-ink">{attribute.name}</span>
    <HudTier tier={attribute.level as 1 | 2 | 3 | 4 | 5} />
    <span className="text-center text-hud-label tabular-nums text-hud-good">{attribute.now}</span>
  </button>
);

/** The attribute the choices open on: the first the XP buys now, else the cheapest. */
const firstChoice = (army: ArmyView): AttributeKey =>
  (
    army.attributes.find(({ next }) => next?.affordable) ??
    army.attributes.toSorted((left, right) => (left.next?.xp ?? Infinity) - (right.next?.xp ?? Infinity))[0]!
  ).key;

/**
 * The army's XP against its next level-up, said only while the XP buys none: a count of what it could buy reads as that
 * many level-ups when it buys one.
 */
const XpLine = ({ army }: { army: ArmyView }) =>
  army.affordable > 0 ? null : (
    <span className="text-hud-label text-hud-muted">
      {army.goal ? ARMY_DETAIL.toNext(formatExact(army.goal.xp - army.xp)) : ARMY_DETAIL.allLegendary}
    </span>
  );

/**
 * The XP held, with how XP is earned on its hover, Level up (lit while the XP buys a level-up, with no count: the
 * choices say which), and the bar to the next level-up.
 */
const XpBlock = ({ army, onLevelUp }: { army: ArmyView; onLevelUp: () => void }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-end justify-between gap-2">
      <span
        className="flex items-baseline gap-1"
        data-tip={army.earn
          .map(({ line, xp }) => (xp === undefined ? line : `${line} ${formatFigure(xp, { signed: true })}`))
          .join(" · ")}
      >
        <span className="text-hud-display tabular-nums text-hud-gold">{formatExact(army.xp)}</span>
        <span className="text-hud-strong text-hud-ink">{XP}</span>
        <Icon name="info" size={14} />
      </span>
      <span className="flex items-center gap-2">
        <XpLine army={army} />
        <HudButton kind={army.affordable > 0 ? "primary" : "secondary"} size="sm" icon="upgrade" onClick={onLevelUp}>
          {army.affordable > 0 ? ARMY_DETAIL.levelUp : ARMY_DETAIL.levelUps}
        </HudButton>
      </span>
    </div>
    {army.goal && <HudMeter share={army.goal.share} tone={army.affordable > 0 ? "good" : undefined} label={XP} />}
  </div>
);

/** One level-up: the attribute, its next level, what it gives next, its XP. */
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
      <span className="text-hud-strong text-hud-ink">
        {attribute.next
          ? RESEARCH_TREE.step(attribute.name, attribute.next.word)
          : ARMY_DETAIL.legendary(attribute.name)}
      </span>
      <span className="text-hud-label tabular-nums text-hud-good">{attribute.next?.change ?? attribute.now}</span>
    </span>
    {attribute.next && (
      <span
        className={cn(
          "shrink-0 text-hud-strong tabular-nums",
          attribute.next.affordable ? "text-hud-gold" : "text-hud-muted",
        )}
      >
        {ARMY_DETAIL.price(formatExact(attribute.next.xp))}
      </span>
    )}
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

/** The chosen level-up and its verb: its XP and the stamina it refills, or the XP still missing. */
const LevelUpFoot = ({
  army,
  chosen,
  sending,
  onLevelUp,
}: {
  army: ArmyView;
  chosen: AttributeView;
  sending: boolean;
  onLevelUp: () => unknown;
}) =>
  chosen.next ? (
    <div className="flex items-center gap-2 border-t border-hud-divider pt-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-hud-body text-hud-ink">
          {ARMY_DETAIL.from(chosen.name, TIER_WORDS[chosen.level - 1]!, chosen.next.word)}
        </span>
        <span className={cn("text-hud-label tabular-nums", chosen.next.affordable ? "text-hud-muted" : "text-hud-bad")}>
          {chosen.next.affordable
            ? ARMY_DETAIL.refills(formatExact(chosen.next.xp), formatExact(chosen.next.refill))
            : ARMY_DETAIL.short(formatExact(chosen.next.xp), formatExact(chosen.next.xp - army.xp))}
        </span>
      </span>
      <HudButton
        kind="primary"
        disabled={!chosen.next.affordable}
        busy={sending ? UPGRADING : undefined}
        onClick={onLevelUp}
      >
        {ARMY_DETAIL.levelUp}
      </HudButton>
    </div>
  ) : (
    <span className="text-hud-body text-hud-good">{ARMY_DETAIL.legendary(chosen.name)}</span>
  );
