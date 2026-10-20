import { formatDuration, formatExact } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudCost, HudPanel, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { ATTACK, XP } from "@/ui/design-system/kit/words";
import { SiteMark } from "@/ui/features/frontier/sites/site-card-view";
import type { ReactNode } from "react";

/**
 * Dev only: three ways the Frontier fight card could state the fight plainly, for the owner to pick before one is
 * wired (owner, 20 October 2026, on the camp card: "we dont understand how many we lose, we kill, how much is
 * lost... Basically the style is right now, but we need to focus on the data and how its shown"). Each says the same
 * five things: what the army sends, what this attack costs it, what it kills, what clearing pays, and when it can
 * attack. Shown at /lab/kit/hud/fight-<option>-<case>, beside today's card at /lab/kit/hud/fight-today-<case>.
 */
export type FightCase = {
  site: string;
  /** The guard's name and painting: a beast's species, or a camp's troops. */
  guard: { name: string; art: IconMeaning; troops: number };
  army: { art: IconMeaning; troops: number };
  /** This attack, exactly as its result will show it. */
  attack: { lost: number; killed: number };
  /** Attacks the whole fight takes to clear the site; 0 when the army is lost first. */
  attacksToClear: number;
  pay: { icon: IconMeaning; amount: number; word: string };
  xp: number;
  /** The stamina one attack costs, what the army holds, and how long until it holds enough (0: now). */
  stamina: { cost: number; held: number; wait: number };
};

/** The owner's camp: 1,500 troops against a Troll guard of 1,300, 14 stamina of the 30 an attack takes. */
const OWNERS_CAMP: FightCase = {
  site: "Camp",
  guard: { name: "Troll", art: "beast-troll", troops: 1_300 },
  army: { art: "knight-t1", troops: 1_500 },
  attack: { lost: 180, killed: 560 },
  attacksToClear: 3,
  pay: { icon: "wood", amount: 650, word: "wood" },
  xp: 90,
  stamina: { cost: 30, held: 14, wait: 31 * 60 },
};

export const FIGHT_CASES = {
  /** The owner's screenshot: a fight it wins in three attacks, not ready for 31 minutes. */
  short: OWNERS_CAMP,
  /** One attack clears it, ready now. */
  ready: {
    site: "Camp",
    guard: { name: "Bandits", art: "troops", troops: 1_100 },
    army: { art: "knight-t1", troops: 5_000 },
    attack: { lost: 180, killed: 1_100 },
    attacksToClear: 1,
    pay: { icon: "labor", amount: 550, word: "labor" },
    xp: 82,
    stamina: { cost: 30, held: 90, wait: 0 },
  },
  /** The army is lost in this attack. */
  loses: {
    ...OWNERS_CAMP,
    army: { art: "knight-t1", troops: 400 },
    attack: { lost: 400, killed: 150 },
    attacksToClear: 0,
    stamina: { cost: 30, held: 60, wait: 0 },
  },
} satisfies Record<string, FightCase>;

export type FightOption = "a" | "b" | "c";

/** One option's card, as the map's tile card opens it: the site, the option's reading of the fight, then Attack. */
export const FightOptionSheet = ({ option, fight }: { option: FightOption; fight: FightCase }) => (
  <HudSheet label={`${fight.site} · option ${option.toUpperCase()}`} onClose={() => undefined}>
    {option === "a" && <LikeItsResult fight={fight} />}
    {option === "b" && <Ledger fight={fight} />}
    {option === "c" && <Lines fight={fight} />}
    <AttackWhen fight={fight} />
  </HudSheet>
);

const lostArmy = (fight: FightCase) => fight.attack.lost >= fight.army.troops;
const clearedNow = (fight: FightCase) => fight.attack.killed >= fight.guard.troops;

/** A: the forecast drawn as its result will read: each side before → after this attack, then what clearing pays. */
const LikeItsResult = ({ fight }: { fight: FightCase }) => (
  <>
    <span className="flex items-center gap-3">
      <SiteMark icon={fight.guard.art} />
      <span className="flex min-w-0 flex-col">
        <span className={cn("text-hud-title", lostArmy(fight) ? "text-hud-bad" : "text-hud-ink")}>
          {outcomeWord(fight)}
        </span>
        <span className="text-hud-body text-hud-muted">{`${fight.guard.name} · ${fight.site}`}</span>
      </span>
    </span>
    <span className="flex gap-2">
      <Side art={fight.army.art} before={fight.army.troops} change={fight.attack.lost} word="you lose" />
      <Side art={fight.guard.art} before={fight.guard.troops} change={fight.attack.killed} word="you kill" />
    </span>
    <Gain fight={fight} />
  </>
);

const Side = ({ art, before, change, word }: { art: IconMeaning; before: number; change: number; word: string }) => {
  const after = Math.max(0, before - change);
  return (
    <HudPanel collapsible={false} className="flex-1" bodyClassName="flex flex-col items-center gap-1 py-2">
      <span className="flex items-center gap-2 tabular-nums">
        <SemanticIcon name={art} size={26} />
        <span className="whitespace-nowrap text-hud-body text-hud-muted">{formatExact(before)} →</span>
        <span className={cn("text-hud-display leading-none", after === 0 ? "text-hud-bad" : "text-hud-ink")}>
          {formatExact(after)}
        </span>
      </span>
      <span className="text-hud-label text-hud-muted">{`${word} ${formatExact(change)}`}</span>
    </HudPanel>
  );
};

/** B: a ledger, the army and the guard side by side: what stands, what this attack takes, what is left. */
const Ledger = ({ fight }: { fight: FightCase }) => {
  const rows: [string, number, number, boolean?][] = [
    ["Stands", fight.army.troops, fight.guard.troops],
    ["This attack", -fight.attack.lost, -fight.attack.killed, true],
    ["Left", Math.max(0, fight.army.troops - fight.attack.lost), Math.max(0, fight.guard.troops - fight.attack.killed)],
  ];
  return (
    <>
      <HudPanel collapsible={false} bodyClassName="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-2 py-2">
        <span />
        <span className="flex items-center justify-end gap-1.5 text-hud-label text-hud-muted">
          <SemanticIcon name={fight.army.art} size={20} />
          Your army
        </span>
        <span className="flex items-center justify-end gap-1.5 text-hud-label text-hud-muted">
          <SemanticIcon name={fight.guard.art} size={20} />
          {fight.guard.name}
        </span>
        {rows.map(([word, army, guard, change]) => (
          <Row key={word} word={word} army={army} guard={guard} change={change === true} />
        ))}
      </HudPanel>
      <span className="text-hud-body text-hud-ink">{outcomeWord(fight)}</span>
      <Gain fight={fight} />
    </>
  );
};

const Row = ({ word, army, guard, change }: { word: string; army: number; guard: number; change: boolean }) => {
  const shown = (value: number) => (change ? `−${formatExact(-value)}` : formatExact(value));
  return (
    <>
      <span className="text-hud-body text-hud-muted">{word}</span>
      <span className={cn("text-right text-hud-strong tabular-nums", change ? "text-hud-bad" : "text-hud-ink")}>
        {shown(army)}
      </span>
      <span className={cn("text-right text-hud-strong tabular-nums", change ? "text-hud-good" : "text-hud-ink")}>
        {shown(guard)}
      </span>
    </>
  );
};

/** C: one plain line for each thing the player weighs, its icon first. */
const Lines = ({ fight }: { fight: FightCase }) => (
  <HudPanel collapsible={false} bodyClassName="flex flex-col gap-2 py-2">
    <Line icon={fight.army.art}>{`You send ${formatExact(fight.army.troops)} troops`}</Line>
    <Line icon="skull" bad>
      {lostArmy(fight)
        ? `You lose all ${formatExact(fight.army.troops)}: the army is gone`
        : `You lose ${formatExact(fight.attack.lost)}`}
    </Line>
    <Line icon={fight.guard.art}>
      {clearedNow(fight)
        ? `You kill all ${formatExact(fight.guard.troops)} ${fight.guard.name}`
        : `You kill ${formatExact(fight.attack.killed)} of ${formatExact(fight.guard.troops)} ${fight.guard.name}`}
    </Line>
    <Line icon={fight.pay.icon}>
      {fight.attacksToClear === 0
        ? "Nothing gained"
        : `${clearsIn(fight)}: +${formatExact(fight.pay.amount)} ${fight.pay.word}, +${formatExact(fight.xp)} ${XP}`}
    </Line>
  </HudPanel>
);

const Line = ({ icon, bad = false, children }: { icon: IconMeaning; bad?: boolean; children: ReactNode }) => (
  <span className={cn("flex items-center gap-2 text-hud-body", bad ? "text-hud-bad" : "text-hud-ink")}>
    <SemanticIcon name={icon} size={22} />
    {children}
  </span>
);

/** What clearing pays, once the guard is gone, and how many attacks that takes; nothing for a fight lost. */
const Gain = ({ fight }: { fight: FightCase }) =>
  fight.attacksToClear === 0 ? null : (
    <HudPanel collapsible={false} bodyClassName="flex items-center justify-between gap-3 py-2">
      <span className="text-hud-label text-hud-muted">{clearsIn(fight)}</span>
      <span className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <SemanticIcon name={fight.pay.icon} size={24} />
          <span className="text-hud-display leading-none tabular-nums text-hud-gold">
            +{formatExact(fight.pay.amount)}
          </span>
        </span>
        <HudChip>{`+${formatExact(fight.xp)} ${XP}`}</HudChip>
      </span>
    </HudPanel>
  );

/** Every option ends the same: Attack, what it costs, and when it can go. */
const AttackWhen = ({ fight }: { fight: FightCase }) => {
  const ready = fight.stamina.wait === 0;
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="grid w-full">
        <HudButton kind={lostArmy(fight) ? "danger" : "primary"} icon="attack" disabled={!ready}>
          {ATTACK}
        </HudButton>
      </span>
      <HudCost line={`${fight.stamina.cost} stamina`} />
      <span className="text-hud-body text-hud-ink">
        {ready
          ? "Ready now"
          : `Ready in ${formatDuration(fight.stamina.wait)}: has ${fight.stamina.held} of ${fight.stamina.cost} stamina`}
      </span>
    </span>
  );
};

const outcomeWord = (fight: FightCase) =>
  lostArmy(fight) ? "Your army is lost" : clearedNow(fight) ? "This attack clears it" : "The guard holds";

const clearsIn = (fight: FightCase) =>
  fight.attacksToClear === 1 ? "Cleared in this attack" : `Cleared in ${fight.attacksToClear} attacks`;
