import type { FrontierBeast } from "@/three/structures/frontier-beast";
import { FRONTIER_TROOP_NAMES, type Troops, type TroopType, formatShort } from "@bibliothecadao/types";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudButton, HudChip, HudNotice, HudPrice, HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { type Price } from "@/ui/design-system/kit/price-faces";
import { type Reason, reasonLine } from "@/ui/design-system/kit/reasons";
import {
  ON_ITS_WAY,
  ARMY,
  ATTACK,
  ATTACKING,
  MOVE,
  REALM,
  RELIC_WORDS,
  REST_DID_NOT_FIT,
  siteTitle,
  SITE_OATH,
  SUPPLY_POST,
  STORAGE,
  tooFarFrom,
  TROOPS,
  FIGHT_RESULT,
  FIGHT_WORDS,
  type TroopFigures,
} from "@/ui/design-system/kit/words";

import type { OrderInFlight } from "@/hooks/store/use-actions-in-flight";
import type { ReactNode } from "react";

import { BaneFigure, BaneLine } from "../day/bane-mark";
import type { ArmyStaminaCosts } from "../deploy/troop-figures";
import { useEnterConfirms } from "../hud/enter-confirms";
import type { Cost } from "../hud/army-order";
import { GuardToken } from "../hud/army-token";
import { UnitDetailsTrigger, type UnitDetailsSubject } from "../troops/unit-details-popover";
import { AttackStamina, FightArena } from "./fight-side";
import { BeastMarkBadge, CombatMarkBadge } from "./combat-mark";
import type { SiteFight } from "./site-card-plan";
import { type AttackTargetKind, TARGET_MARKS, attackTargetName } from "./site-marks";

export type SiteVerb =
  | {
      kind: "attack";
      stamina: number;
      inFlight?: OrderInFlight;
      refused?: string;
      onAttack: () => void;
    }
  | { kind: "move"; prices: readonly Price[]; onMove: () => void }
  | { kind: "short"; stamina: Cost }
  | { kind: "far" }
  | { kind: "blocked"; reason: string };

export const SiteCardView = ({
  site,
  name,
  beast,
  army,
  guard,
  defenderCategory,
  figures,
  fight,
  pay,
  relic,
  holdsOath = false,
  opensPost = false,
  cache,
  replacement,
  verb,
  receipt,
  onRealm,
  onClose,
}: {
  site: AttackTargetKind;
  name?: string;
  beast: (Pick<FrontierBeast, "beast" | "name"> & { combatClass: Troops["category"] }) | undefined;
  army: { art: IconMeaning; troops: number; category?: TroopType; staminaCosts?: ArmyStaminaCosts } | null;
  guard: number | null | undefined;
  defenderCategory?: TroopType;
  figures?: TroopFigures;
  fight: SiteFight | undefined;
  pay: { icon: IconMeaning; amount: number; fits?: number } | null;
  relic?: ReactNode;
  holdsOath?: boolean;
  opensPost?: boolean;
  cache?: number;
  replacement?: ReactNode;
  verb: SiteVerb | null;
  receipt?: ReactNode;
  onRealm?: () => void;
  onClose: () => void;
}) => {
  const { icon } = TARGET_MARKS[site];
  const word = attackTargetName(site, beast);
  const title = name ? siteTitle(name, word, beast?.name) : word;
  const armyless = army === null;
  const guardIcon = beast ? beastMeaning(beast.beast) : "troops";
  const enemyCategory = beast?.combatClass ?? defenderCategory;
  const siteGuard = site !== "Army";
  const facing = facingOf(army, guard, fight);
  const lost = facing !== undefined && isArmyLost(facing);
  const reward =
    cache !== undefined || relic || pay || holdsOath || opensPost ? (
      <Reward dimmed={facing !== undefined && !clears(facing)}>
        {cache !== undefined ? <CachePay fragments={cache} /> : relic ? relic : pay ? <Pay pay={pay} /> : null}
        {holdsOath && (
          <HudChip icons={["shrine"]} tip={SITE_OATH.rule}>
            {SITE_OATH.label}
          </HudChip>
        )}
        {opensPost && (
          <HudChip icons={["flag"]} tip={SUPPLY_POST.rule}>
            {SUPPLY_POST.chip}
          </HudChip>
        )}
      </Reward>
    ) : null;
  const what = beast?.name !== title ? beast?.name : undefined;
  const armylessEnemyDetails: UnitDetailsSubject | undefined = enemyCategory
    ? {
        role: beast ? "beast" : "enemyArmy",
        name: beast?.name ?? FRONTIER_TROOP_NAMES[enemyCategory].many,
        art: guardIcon,
        category: enemyCategory,
        strength: typeof guard === "number" ? guard : undefined,
        figures,
      }
    : undefined;
  const guardToken =
    typeof guard === "number" ? (
      <GuardToken
        label={beast?.name ?? TROOPS}
        art={guardIcon}
        troops={guard}
        mark={
          enemyCategory &&
          (beast ? <BeastMarkBadge category={enemyCategory} /> : <CombatMarkBadge category={enemyCategory} />)
        }
      />
    ) : null;
  return (
    <HudSheet label={title} cue={<HudChip icons={[icon]}>{TARGET_MARKS[site].word}</HudChip>} onClose={onClose}>
      {armyless ? (
        <header className="flex items-center gap-3">
          {guardToken ? (
            <BaneFigure figure="guards" pill altered={siteGuard}>
              {armylessEnemyDetails ? (
                <UnitDetailsTrigger subject={armylessEnemyDetails} openOnClick>
                  {guardToken}
                </UnitDetailsTrigger>
              ) : (
                guardToken
              )}
            </BaneFigure>
          ) : (
            <SiteMark icon={beast ? beastMeaning(beast.beast) : icon} />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            {what && <span className="text-hud-label text-hud-muted">{what}</span>}
            {reward}
          </span>
        </header>
      ) : (
        <>
          <FightPanel
            army={army}
            guard={guard}
            facing={facing}
            beast={beast}
            enemyCategory={enemyCategory}
            figures={figures}
            guardIcon={guardIcon}
            siteGuard={siteGuard}
          />
          {(facing || reward) && (
            <div className="fight-spoils">
              {facing && <Outcome facing={facing} />}
              {reward}
            </div>
          )}
        </>
      )}
      {siteGuard && typeof guard === "number" && <BaneLine figure="guards" />}
      {receipt}
      {replacement}
      <Verb
        verb={verb}
        site={word}
        armyLost={lost}
        onRealm={pay?.fits !== undefined && pay.fits < pay.amount ? onRealm : undefined}
      />
    </HudSheet>
  );
};

type KnownFight = Exclude<SiteFight, { refused: true }>;
type Facing = { army: { art: IconMeaning; troops: number }; guard: number; fight: KnownFight };

const facingOf = (
  army: Facing["army"] | null,
  guard: number | null | undefined,
  fight: SiteFight | undefined,
): Facing | undefined =>
  army && typeof guard === "number" && fight && !("refused" in fight) ? { army, guard, fight } : undefined;

const armyLeft = ({ army, fight }: Facing) => Math.max(0, army.troops - fight.troopsLost);
const isArmyLost = (facing: Facing) => armyLeft(facing) === 0;
const clears = (facing: Facing) => !isArmyLost(facing) && facing.fight.guardLeft === 0;

const outcomeWord = (facing: Facing): string => {
  if (isArmyLost(facing)) return FIGHT_WORDS.armyLost;
  if (!clears(facing)) return FIGHT_WORDS.holds;
  return FIGHT_RESULT.victory;
};

const CachePay = ({ fragments }: { fragments: number }) => (
  <span data-ruin-cache>
    <HudChip icons={["fragment"]}>{RELIC_WORDS.cache(fragments)}</HudChip>
  </span>
);

const Reward = ({ dimmed, children }: { dimmed: boolean; children: ReactNode }) => (
  <span data-fight-reward className={cn("flex flex-wrap items-center gap-2", dimmed && "opacity-50")}>
    {children}
  </span>
);

const SiteMark = ({ icon, children }: { icon: IconMeaning; children?: ReactNode }) => (
  <span
    className={cn(
      "relative flex size-16 shrink-0 items-center justify-center rounded-xl border border-hud-line bg-hud-surface",
    )}
  >
    <SemanticIcon name={icon} size={36} />
    {children}
  </span>
);

const FightPanel = ({
  army,
  guard,
  facing,
  beast,
  enemyCategory,
  figures,
  guardIcon,
  siteGuard,
}: {
  army: { art: IconMeaning; troops: number; category?: TroopType; staminaCosts?: ArmyStaminaCosts } | null;
  guard: number | null | undefined;
  facing: Facing | undefined;
  beast: (Pick<FrontierBeast, "beast" | "name"> & { combatClass: Troops["category"] }) | undefined;
  enemyCategory: TroopType | undefined;
  figures: TroopFigures | undefined;
  guardIcon: IconMeaning;
  siteGuard: boolean;
}) => (
  <FightArena
    ours={
      army
        ? {
            label: ARMY,
            mark: <SemanticIcon name={army.art} size={96} className="size-full" />,
            before: army.troops,
            kept: facing && armyLeft(facing),
            combatCategory: army.category,
            details: army.category
              ? {
                  role: "player",
                  name: FRONTIER_TROOP_NAMES[army.category].many,
                  art: army.art,
                  category: army.category,
                  strength: army.troops,
                  figures,
                  staminaCosts: army.staminaCosts,
                }
              : undefined,
          }
        : undefined
    }
    theirs={
      guard !== null
        ? {
            label: beast?.name ?? TROOPS,
            mark: <SemanticIcon name={guardIcon} size={96} className="size-full" />,
            before: guard,
            kept: facing?.fight.guardLeft,
            bane: siteGuard ? "guards" : undefined,
            combatCategory: enemyCategory,
            beastMark: Boolean(beast),
            details: enemyCategory
              ? {
                  role: beast ? "beast" : "enemyArmy",
                  name: beast?.name ?? FRONTIER_TROOP_NAMES[enemyCategory].many,
                  art: guardIcon,
                  category: enemyCategory,
                  strength: typeof guard === "number" ? guard : undefined,
                  figures,
                  vsCategory: army?.category,
                }
              : undefined,
          }
        : undefined
    }
  />
);

const Outcome = ({ facing }: { facing: Facing }) => (
  <b
    data-fight-outcome
    className={cn(
      "text-hud-label",
      isArmyLost(facing) ? "text-hud-bad" : clears(facing) ? "text-hud-good" : "text-hud-muted",
    )}
  >
    {outcomeWord(facing)}
  </b>
);

const Pay = ({ pay }: { pay: { icon: IconMeaning; amount: number; fits?: number } }) => {
  const short = pay.fits !== undefined && pay.fits < pay.amount;
  return (
    <span className="flex items-center gap-1.5">
      <HudChip icons={[pay.icon]} tone="good">
        {formatShort(short ? pay.fits : pay.amount, { signed: true })}
      </HudChip>
      {short && (
        <HudChip label={STORAGE} tone="bad">
          {REST_DID_NOT_FIT}
        </HudChip>
      )}
    </span>
  );
};

const Verb = ({
  verb,
  site,
  armyLost,
  onRealm,
}: {
  verb: SiteVerb | null;
  site: string;
  armyLost: boolean;
  onRealm: (() => void) | undefined;
}) => {
  const warns = verb?.kind === "attack" && armyLost;
  useEnterConfirms(verb?.kind === "attack" && !verb.inFlight && !warns ? verb.onAttack : undefined);
  if (!verb) return null;
  return (
    <>
      <VerbLine {...verbLine(verb, site)} />
      <HudWindowFoot note={<FootNote verb={verb} site={site} />}>
        {onRealm && (
          <HudButton kind="secondary" icon="realm" onClick={onRealm}>
            {REALM}
          </HudButton>
        )}
        {verb.kind === "move" ? (
          <HudButton kind="primary" icon="move" onClick={verb.onMove}>
            {MOVE}
          </HudButton>
        ) : (
          <HudButton
            kind={warns ? "danger" : "primary"}
            icon="attack"
            aria-label={verb.kind === "attack" && !verb.inFlight ? ATTACK : undefined}
            busy={verb.kind === "attack" ? inFlightWord(verb.inFlight, "attack", ATTACKING) : undefined}
            disabled={verb.kind !== "attack"}
            onClick={verb.kind === "attack" ? verb.onAttack : undefined}
          >
            {ATTACK}
            {verb.kind === "attack" && <AttackStamina stamina={verb.stamina} />}
          </HudButton>
        )}
      </HudWindowFoot>
    </>
  );
};

export const inFlightWord = (inFlight: OrderInFlight | undefined, own: OrderInFlight, word: string) =>
  inFlight && (inFlight === own ? word : ON_ITS_WAY);

const verbLine = (verb: SiteVerb, site: string): { line: string | undefined; warns: boolean } => {
  if (verb.kind === "blocked") return { line: verb.reason, warns: true };
  if (verb.kind === "attack" && verb.refused && !verb.inFlight) return { line: verb.refused, warns: true };
  return { line: verb.kind === "move" ? tooFarFrom(site) : undefined, warns: false };
};

const FootNote = ({ verb, site }: { verb: SiteVerb; site: string }) => {
  switch (verb.kind) {
    case "attack":
    case "blocked":
      return null;
    case "move":
      return <HudPrice prices={verb.prices} />;
    default:
      return <HudNotice tone={verb.kind === "short" ? "bad" : "warn"} line={reasonLine(heldBack(verb, site))} />;
  }
};

const heldBack = (verb: Extract<SiteVerb, { kind: "short" | "far" }>, site: string): Reason => {
  if (verb.kind === "far") return { kind: "failed", line: tooFarFrom(site) };
  const { cost, held, wait } = verb.stamina;
  return { kind: "short", of: "stamina", held, need: cost, wait };
};

const VerbLine = ({ line, warns }: { line: string | undefined; warns: boolean }) =>
  line === undefined ? null : (
    <p role="status" className={cn("text-center text-hud-body", warns ? "text-hud-bad" : "text-hud-ink")}>
      {line}
    </p>
  );
