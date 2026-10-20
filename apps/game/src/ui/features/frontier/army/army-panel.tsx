import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudPortrait } from "@/ui/design-system/kit/hud-elements";
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
import { formatExact, formatFigure } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";

import type { ArmyView, AttributeKey, AttributeView, ScoutKind } from "./army-detail";

const KINDS: { key: ScoutKind; icon: IconMeaning }[] = [
  { key: "camp", icon: "camp" },
  { key: "rift", icon: "rift" },
  { key: "beasts", icon: "beasts" },
];

/**
 * An army's detail (the owner's pick, 20 October: "For the army C is best"), in two steps in one place. First its
 * figures: troops and stamina (with the refill), what each attribute gives as a plain table, its XP against its next
 * level-up and how XP is earned, then Level up: the primary once the XP buys a level, else a way to see what it will
 * buy. Level up turns the same place to the four choices, each with what it gives next and its XP, Scouting's kind, and
 * the verb, with a way back.
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
  return (
    <div data-army-step="stats" className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-3">
        <HudPortrait icon={army.art} label={TROOPS} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <HudChip icons={["troops"]} label={TROOPS}>
            {formatExact(army.troops)}
          </HudChip>
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
      <dl className="flex flex-col gap-1.5">
        {army.attributes.map((attribute) => (
          <div key={attribute.key} className="flex items-center gap-2">
            <Icon name={attribute.mark} size={20} />
            <dt className="flex-1 text-hud-body text-hud-muted">{attribute.stat}</dt>
            <dd className="text-hud-strong tabular-nums text-hud-ink">{attribute.now}</dd>
          </div>
        ))}
      </dl>
      <XpBlock army={army} />
      <div className="flex justify-end">
        <HudButton kind={army.affordable > 0 ? "primary" : "secondary"} onClick={() => setOpen(true)}>
          {army.affordable > 0 ? ARMY_DETAIL.levelUpReady(army.affordable) : ARMY_DETAIL.levelUps}
        </HudButton>
      </div>
    </div>
  );
};

/** The attribute the choices open on: the first the XP buys now, else the cheapest. */
const firstChoice = (army: ArmyView): AttributeKey =>
  (
    army.attributes.find(({ next }) => next?.affordable) ??
    army.attributes.toSorted((left, right) => (left.next?.xp ?? Infinity) - (right.next?.xp ?? Infinity))[0]!
  ).key;

/** The army's XP, against what it buys. */
const XpLine = ({ army }: { army: ArmyView }) => (
  <span className="text-hud-label text-hud-muted">
    {army.affordable > 0
      ? ARMY_DETAIL.ready(army.affordable)
      : army.goal
        ? ARMY_DETAIL.toNext(formatExact(army.goal.xp - army.xp))
        : ARMY_DETAIL.allLegendary}
  </span>
);

/** The XP held, the bar to the next level-up, and how XP is earned. */
const XpBlock = ({ army }: { army: ArmyView }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-end justify-between gap-2">
      <span className="flex items-baseline gap-1">
        <span className="text-hud-display tabular-nums text-hud-gold">{formatExact(army.xp)}</span>
        <span className="text-hud-strong text-hud-ink">{XP}</span>
      </span>
      <XpLine army={army} />
    </div>
    {army.goal && <HudMeter share={army.goal.share} tone={army.affordable > 0 ? "good" : undefined} label={XP} />}
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-hud-label text-hud-muted">
      {army.earn.map(({ icon, line, xp }) => (
        <span key={line} className="flex items-center gap-1">
          <Icon name={icon} size={16} />
          {line}
          {xp !== undefined && <span className="tabular-nums text-hud-gold">{formatFigure(xp, { signed: true })}</span>}
        </span>
      ))}
    </div>
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
      <span className="text-hud-label text-hud-muted">{attribute.stat}</span>
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
