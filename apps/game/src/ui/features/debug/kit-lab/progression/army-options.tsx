import { Icon } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudIconButton,
  HudMeter,
  HudPanel,
  HudPortrait,
  HudRarity,
} from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { ArmySheet } from "@/ui/features/frontier/army/army-sheet";
import { ArmyList, ArmyRow } from "@/ui/features/frontier/hud/army-row";
import { useState } from "react";

import { type AttributeKey, type AttributeView, type ArmyView, readArmy } from "./army-detail";
import type { ArmyFacts } from "./progression-facts";

const noop = () => undefined;
const KINDS = [
  { key: "camp", icon: "camp", name: "Camps" },
  { key: "rift", icon: "rift", name: "Rifts" },
  { key: "beasts", icon: "beasts", name: "Beasts" },
] as const;

/** The attribute a proposal opens on: the first the XP buys now, else the cheapest. */
const firstChoice = (army: ArmyView): AttributeKey =>
  (
    army.attributes.find(({ next }) => next?.affordable) ??
    army.attributes.toSorted((left, right) => (left.next?.xp ?? Infinity) - (right.next?.xp ?? Infinity))[0]!
  ).key;

/**
 * Today: the army's row in the Armies panel (owner-armies.png), and the army sheet it opens only through Upgrade, once a
 * tier is affordable; with 12 XP the sheet cannot be reached at all. The sheet is drawn in a frame of its own here.
 */
export const ArmyToday = ({ army: facts }: { army: ArmyFacts }) => {
  const army = readArmy(facts);
  return (
    <div className="flex flex-col gap-3">
      <ArmyList used={1} allowed={3}>
        <ArmyRow
          label={army.name}
          number={1}
          art="knight-t1"
          troops={army.troops}
          stamina={army.stamina}
          xp={army.xp}
          xpGoal={army.goal && { price: army.goal.xp, tier: 2 }}
          canBuyTier={army.affordable > 0}
          selected={false}
          onPick={noop}
          onUpgrade={noop}
        />
      </ArmyList>
      <span className="text-hud-label text-hud-muted">
        {army.affordable > 0
          ? "Upgrade on the row opens the sheet below."
          : "No Upgrade on the row: the sheet below cannot be opened."}
      </span>
      {/* The sheet is fixed to the screen's right; a transformed frame keeps it in its column here. */}
      <div className="relative h-[760px] w-[456px] [transform:translateZ(0)]">
        <ArmySheet
          name={army.name}
          art="knight-t1"
          troops={army.troops}
          xp={army.xp}
          stamina={{ ...army.stamina, secondsToFull: (army.stamina.max - army.stamina.current) * 2 }}
          attributes={{
            battle: { tier: facts.battle as Tier },
            logistics: { tier: facts.logistics as Tier },
            scouting: { tier: facts.scouting as Tier, kinds: facts.scoutingKinds },
            homecoming: { tier: facts.homecoming as Tier },
          }}
          tierPrices={{ 2: 100, 3: 200, 4: 400, 5: 800 }}
          effects={{
            battle: ladder(army, "battle"),
            logistics: ladder(army, "logistics"),
            scouting: ladder(army, "scouting"),
            homecoming: ladder(army, "homecoming"),
          }}
          refillOnBuy={30}
          chosen={firstChoice(army)}
          onChoose={noop}
          kindRates={{ camp: ["+0%", "+10%"], rift: ["+0%", "+10%"], beasts: ["+0%", "+10%"] }}
          kind="rift"
          onKind={noop}
          sending={false}
          onUpgrade={noop}
          onClose={noop}
        />
      </div>
    </div>
  );
};

const ladder = (army: ArmyView, key: AttributeKey) =>
  army.attributes.find((attribute) => attribute.key === key)!.ladder as unknown as readonly [
    string,
    string,
    string,
    string,
    string,
  ];

/** The army's head, shared: its painting, name, troops and stamina. */
const ArmyHead = ({ army }: { army: ArmyView }) => (
  <div className="flex items-center gap-3 px-3 pt-1">
    <HudPortrait icon="knight-t1" label="Knights" />
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex items-center gap-2">
        <span className="text-hud-title text-hud-ink">{army.name}</span>
        <HudChip icons={["troops"]} label="Troops">
          {army.troops.toLocaleString("en-US")}
        </HudChip>
      </span>
      <span className="flex items-center gap-2 text-hud-label tabular-nums text-hud-muted">
        <Icon name="stamina" size={16} />
        <span className="min-w-16 flex-1">
          <HudMeter amount={army.stamina} tone="good" label="Stamina" />
        </span>
        {army.stamina.current}/{army.stamina.max}
      </span>
    </div>
  </div>
);

/** The army's XP against its cheapest next level, and how XP is earned. */
const XpBlock = ({ army, earn = true }: { army: ArmyView; earn?: boolean }) => (
  <div className="flex flex-col gap-2 px-3">
    <div className="flex items-end justify-between gap-2">
      <span className="flex items-baseline gap-1">
        <span className="text-hud-display tabular-nums text-hud-gold">{army.xp}</span>
        <span className="text-hud-strong text-hud-ink">XP</span>
      </span>
      <span className="text-hud-label text-hud-muted">
        {army.affordable > 0
          ? `${army.affordable} level-up${army.affordable === 1 ? "" : "s"} ready`
          : army.goal
            ? `${army.goal.xp - army.xp} XP to the next level-up`
            : "Every attribute legendary"}
      </span>
    </div>
    {army.goal && <HudMeter share={army.goal.share} tone={army.affordable > 0 ? "good" : undefined} label="XP" />}
    {earn && (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-hud-label text-hud-muted">
        {army.earn.map(({ icon, line, xp }) => (
          <span key={line} className="flex items-center gap-1">
            <Icon name={icon} size={16} />
            {line} <span className="tabular-nums text-hud-gold">{xp}</span>
          </span>
        ))}
      </div>
    )}
  </div>
);

/** The verb at the foot: level the chosen attribute up, its XP price, or the XP still missing. */
const LevelUpFoot = ({
  army,
  chosen,
  kind,
  onKind,
}: {
  army: ArmyView;
  chosen: AttributeView;
  kind: string;
  onKind: (kind: string) => void;
}) => (
  <div className="flex flex-col gap-2 border-t border-hud-divider px-3 pb-3 pt-3">
    {chosen.key === "scouting" && chosen.next && (
      <div className="grid grid-cols-3 gap-2">
        {KINDS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={kind === option.key}
            onClick={() => onKind(option.key)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-md border py-1.5 text-hud-body",
              kind === option.key
                ? "border-hud-line-strong bg-hud-chosen text-hud-ink"
                : "border-hud-line text-hud-muted",
            )}
          >
            <Icon name={option.icon} size={22} />
            {option.name}
          </button>
        ))}
      </div>
    )}
    {chosen.next ? (
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-hud-body text-hud-ink">
            {chosen.name} {chosen.levelWord} → {chosen.next.word}
          </span>
          <span
            className={cn("text-hud-label tabular-nums", chosen.next.affordable ? "text-hud-muted" : "text-hud-bad")}
          >
            {chosen.next.affordable
              ? `${chosen.next.xp} XP · refills ${army.refill} stamina`
              : `${chosen.next.xp} XP · ${chosen.next.xp - army.xp} XP short`}
          </span>
        </span>
        <HudButton kind="primary" disabled={!chosen.next.affordable}>
          Level up
        </HudButton>
      </div>
    ) : (
      <span className="text-hud-body text-hud-good">{chosen.name} is legendary.</span>
    )}
  </div>
);

/**
 * A · Character sheet (Heroes of Might and Magic's hero screen): the army's head and XP with how XP is earned, its four
 * attributes as a grid of what each gives now and its level, then the four level-up choices, each with what it gives
 * next and its XP; the chosen one's verb at the foot.
 */
export const ArmyCharacter = ({ army: facts }: { army: ArmyFacts }) => {
  const army = readArmy(facts);
  const [chosen, setChosen] = useState<AttributeKey>(() => firstChoice(army));
  const [kind, setKind] = useState("rift");
  const pick = army.attributes.find(({ key }) => key === chosen)!;
  return (
    <HudPanel title={army.name} icon="troops" cue={<HudIconButton icon="close" label="Close" kind="quiet" size="sm" />}>
      <div className="flex flex-col gap-3 pt-2">
        <ArmyHead army={army} />
        <XpBlock army={army} />
        <div className="grid grid-cols-2 gap-2 px-3">
          {army.attributes.map((attribute) => (
            <div
              key={attribute.key}
              className="flex flex-col gap-1 rounded-md border border-hud-line bg-hud-well px-2 py-2"
            >
              <span className="flex items-center gap-1">
                <Icon name={attribute.mark} size={22} />
                <span className="truncate text-hud-strong text-hud-ink">{attribute.name}</span>
              </span>
              <span className="flex items-center gap-1 text-hud-label text-hud-muted">
                <HudRarity tier={attribute.level as 1 | 2 | 3 | 4 | 5} />
                {attribute.levelWord}
              </span>
              <span className="text-hud-label text-hud-muted">{attribute.stat}</span>
              <span className="text-hud-title tabular-nums text-hud-ink">{attribute.now}</span>
            </div>
          ))}
        </div>
        <span className="px-3 text-hud-label uppercase tracking-wide text-hud-muted">Level up</span>
        <div className="flex flex-col">
          {army.attributes.map((attribute) => (
            <button
              key={attribute.key}
              type="button"
              aria-pressed={chosen === attribute.key}
              onClick={() => setChosen(attribute.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-left",
                chosen === attribute.key ? "bg-hud-chosen" : "hover:bg-hud-hover",
              )}
            >
              <Icon name={attribute.mark} size={26} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-hud-body text-hud-ink">
                  {attribute.name}{" "}
                  <span className="text-hud-muted">{attribute.next ? `→ ${attribute.next.word}` : "· legendary"}</span>
                </span>
                <span className="text-hud-label tabular-nums text-hud-good">
                  {attribute.next ? attribute.next.change : attribute.now}
                </span>
              </span>
              {attribute.next && (
                <span
                  className={cn(
                    "text-hud-strong tabular-nums",
                    attribute.next.affordable ? "text-hud-gold" : "text-hud-muted",
                  )}
                >
                  {attribute.next.xp} XP
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <LevelUpFoot army={army} chosen={pick} kind={kind} onKind={setKind} />
    </HudPanel>
  );
};

/**
 * B · Tracks (XCOM's promotions, a skill track per attribute): every attribute's five levels laid out with what each
 * gives, the reached ones filled, the next one lit with its XP; picking a lit level puts its verb at the foot. The whole
 * road is in view at once.
 */
export const ArmyTracks = ({ army: facts }: { army: ArmyFacts }) => {
  const army = readArmy(facts);
  const [chosen, setChosen] = useState<AttributeKey>(() => firstChoice(army));
  const [kind, setKind] = useState("rift");
  const pick = army.attributes.find(({ key }) => key === chosen)!;
  return (
    <HudPanel title={army.name} icon="troops" cue={<HudIconButton icon="close" label="Close" kind="quiet" size="sm" />}>
      <div className="flex flex-col gap-3 pt-2">
        <ArmyHead army={army} />
        <XpBlock army={army} />
        {army.attributes.map((attribute) => (
          <div key={attribute.key} className="flex flex-col gap-1 px-3">
            <span className="flex items-center gap-1">
              <Icon name={attribute.mark} size={22} />
              <span className="text-hud-strong text-hud-ink">{attribute.name}</span>
              <span className="flex-1 text-hud-label text-hud-muted">· {attribute.stat}</span>
              <span className="text-hud-label tabular-nums text-hud-ink">{attribute.now}</span>
            </span>
            <span className="grid grid-cols-5 gap-1">
              {attribute.ladder.map((value, index) => {
                const level = index + 1;
                const reached = level <= attribute.level;
                const next = level === attribute.level + 1;
                return (
                  <button
                    key={level}
                    type="button"
                    disabled={!next}
                    onClick={() => setChosen(attribute.key)}
                    aria-pressed={next && chosen === attribute.key}
                    className={cn(
                      "flex flex-col items-center rounded border py-1",
                      reached && "border-hud-line-strong bg-hud-chosen",
                      next && (attribute.next?.affordable ? "border-hud-good" : "border-dashed border-hud-line-strong"),
                      next && chosen === attribute.key && "outline outline-2 outline-[rgb(var(--hud-accent))]",
                      !reached && !next && "border-hud-divider opacity-50",
                    )}
                  >
                    <span className="text-hud-badge text-hud-muted">
                      {["Com", "Unc", "Rare", "Epic", "Leg"][index]}
                    </span>
                    <span className="text-hud-label tabular-nums text-hud-ink">{value}</span>
                    {next && attribute.next && (
                      <span
                        className={cn(
                          "text-hud-badge tabular-nums",
                          attribute.next.affordable ? "text-hud-gold" : "text-hud-muted",
                        )}
                      >
                        {attribute.next.xp} XP
                      </span>
                    )}
                  </button>
                );
              })}
            </span>
          </div>
        ))}
      </div>
      <LevelUpFoot army={army} chosen={pick} kind={kind} onKind={setKind} />
    </HudPanel>
  );
};

/**
 * C · Stats, then Level up (Blitz's own detail panel): the army's figures as a plain table, its XP with one Level up
 * verb (the primary once the XP buys a level, else a way to see what it will buy); it turns the same panel to the four
 * choices, with a way back. Two steps, the least to read.
 */
export const ArmyStats = ({ army: facts, choosing = false }: { army: ArmyFacts; choosing?: boolean }) => {
  const army = readArmy(facts);
  const [open, setOpen] = useState(choosing);
  const [chosen, setChosen] = useState<AttributeKey>(() => firstChoice(army));
  const [kind, setKind] = useState("rift");
  const pick = army.attributes.find(({ key }) => key === chosen)!;
  return (
    <HudPanel
      title={open ? `${army.name} · Level up` : army.name}
      icon="troops"
      cue={
        open ? (
          <HudIconButton icon="arrow-left" label="Back" kind="quiet" size="sm" onClick={() => setOpen(false)} />
        ) : (
          <HudIconButton icon="close" label="Close" kind="quiet" size="sm" />
        )
      }
    >
      <div className="flex flex-col gap-3 pt-2">
        {!open && <ArmyHead army={army} />}
        {!open && (
          <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1.5 px-3">
            {army.attributes.map((attribute) => (
              <div key={attribute.key} className="contents">
                <Icon name={attribute.mark} size={20} />
                <dt className="text-hud-body text-hud-muted">{attribute.stat}</dt>
                <dd className="text-right text-hud-strong tabular-nums text-hud-ink">{attribute.now}</dd>
              </div>
            ))}
          </dl>
        )}
        <XpBlock army={army} earn={!open} />
        {!open && (
          <div className="flex justify-end px-3 pb-3">
            <HudButton kind={army.affordable > 0 ? "primary" : "secondary"} onClick={() => setOpen(true)}>
              {army.affordable > 0 ? `Level up · ${army.affordable} ready` : "Level-ups"}
            </HudButton>
          </div>
        )}
        {open &&
          army.attributes.map((attribute) => (
            <button
              key={attribute.key}
              type="button"
              aria-pressed={chosen === attribute.key}
              onClick={() => setChosen(attribute.key)}
              className={cn(
                "mx-3 flex items-center gap-2 rounded-md border px-2 py-2 text-left",
                chosen === attribute.key ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line",
              )}
            >
              <Icon name={attribute.mark} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-hud-strong text-hud-ink">
                  {attribute.name} → {attribute.next?.word ?? "legendary"}
                </span>
                <span className="text-hud-label text-hud-muted">{attribute.stat}</span>
                <span className="text-hud-label tabular-nums text-hud-good">
                  {attribute.next ? attribute.next.change : attribute.now}
                </span>
              </span>
              {attribute.next && (
                <span
                  className={cn(
                    "text-hud-strong tabular-nums",
                    attribute.next.affordable ? "text-hud-gold" : "text-hud-muted",
                  )}
                >
                  {attribute.next.xp} XP
                </span>
              )}
            </button>
          ))}
      </div>
      {open && <LevelUpFoot army={army} chosen={pick} kind={kind} onKind={setKind} />}
    </HudPanel>
  );
};
