import { formatExact, formatCharge } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudCost,
  HudMeter,
  HudNotice,
  HudRarity,
  HudRow,
  HudSheet,
} from "@/ui/design-system/kit/hud-elements";
import { FullIn } from "../full-in";
import { shortfallLine } from "@/ui/design-system/kit/reasons";

import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { costLine } from "@/ui/design-system/kit/price-faces";
import { ATTRIBUTES, FIND_KINDS, FULL, STAMINA, TROOPS, UPGRADE, UPGRADING, XP } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

export type AttributeKey = "battle" | "logistics" | "scouting" | "homecoming";
type ScoutKind = "camp" | "rift" | "beasts";

const ATTRIBUTE_KEYS: AttributeKey[] = ["battle", "logistics", "scouting", "homecoming"];
const MARKS: Record<AttributeKey, IconMeaning> = {
  battle: "order-rage",
  logistics: "order-skill",
  scouting: "order-detection",
  homecoming: "order-enlightenment",
};
const KIND_ICONS: Record<ScoutKind, IconMeaning> = { camp: "camp", rift: "rift", beasts: "troops" };
const KINDS: ScoutKind[] = ["camp", "rift", "beasts"];

/** One attribute of the army: its tier, and for Scouting the kind each tier above common went to. */
type AttributeState = { tier: Tier; kinds?: readonly ScoutKind[] };

/**
 * The army (wireframe 08): its head (troops and XP, no level), its stamina against its own maximum with Full in and
 * the refill's place, its four attributes as rows (the Aspect's mark and word, the tier as frame and pips, the next
 * tier's XP price lit when affordable, a tick at legendary), then the chosen row: the tier now and next, what it
 * changes, the stamina a purchase refills (what fits of it), and Upgrade with the XP price, or the XP held against it.
 * Buying Scouting chooses its kind: camps, rifts or beasts, each with its find rate before and after.
 */
export const ArmySheet = ({
  name,
  art,
  troops,
  xp,
  stamina,
  refill,
  attributes,
  tierPrices,
  effects,
  refillOnBuy,
  chosen,
  onChoose,
  kindRates,
  kind,
  onKind,
  sending,
  onUpgrade,
  onClose,
}: {
  name: string;
  art: IconMeaning;
  troops: number;
  xp: number;
  stamina: { current: number; max: number; secondsToFull: number | undefined };
  /** The refill's control on the stamina row: Refill priced in LORDS, or the LORDS held against it. */
  refill?: ReactNode;
  attributes: Record<AttributeKey, AttributeState>;
  /** The XP each tier costs to reach, uncommon to legendary. */
  tierPrices: Record<2 | 3 | 4 | 5, number>;
  /** What each tier gives, common to legendary, as the preset's tables say it ("+30%", "200"). */
  effects: Record<AttributeKey, readonly [string, string, string, string, string]>;
  /** The stamina a tier purchase refills, before the army's maximum caps it. */
  refillOnBuy: number;
  chosen: AttributeKey;
  onChoose: (attribute: AttributeKey) => void;
  /** Each kind's find rate before and after the Scouting tier being bought. */
  kindRates: Record<ScoutKind, readonly [string, string]>;
  kind: ScoutKind;
  onKind: (kind: ScoutKind) => void;
  sending: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={name} onClose={onClose}>
    <header className="flex h-11 items-center gap-2">
      <SemanticIcon name={art} alt="" className="size-10 rounded-full border border-hud-line object-cover" />
      <HudChip icons={["troops"]} label={TROOPS}>
        {formatExact(troops)}
      </HudChip>
      <span className="flex-1" />
      <span className="text-hud-display leading-none tabular-nums text-hud-gold">{formatExact(xp)}</span>
      <span className="text-hud-strong text-hud-ink">{XP}</span>
    </header>
    <div className="flex h-12 items-center gap-2">
      <SemanticIcon name="stamina" size={22} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-hud-body tabular-nums text-hud-ink">
          {formatExact(stamina.current)} / {formatExact(stamina.max)}
        </span>
        <HudMeter share={stamina.max > 0 ? stamina.current / stamina.max : 0} label={STAMINA} />
      </span>
      {stamina.secondsToFull !== undefined && stamina.secondsToFull > 0 && <FullIn seconds={stamina.secondsToFull} />}
      {refill}
    </div>
    {ATTRIBUTE_KEYS.map((key, index) => (
      <AttributeRow
        key={key}
        word={ATTRIBUTES[index]}
        mark={MARKS[key]}
        state={attributes[key]}
        price={nextPrice(attributes[key].tier, tierPrices)}
        affordable={xp >= (nextPrice(attributes[key].tier, tierPrices) ?? Infinity)}
        chosen={key === chosen}
        onChoose={() => onChoose(key)}
      />
    ))}
    <ChosenTier
      attribute={chosen}
      state={attributes[chosen]}
      xp={xp}
      price={nextPrice(attributes[chosen].tier, tierPrices)}
      effects={effects[chosen]}
      refills={Math.max(0, Math.min(refillOnBuy, stamina.max - stamina.current))}
      refillOnBuy={refillOnBuy}
      kindRates={kindRates}
      kind={kind}
      onKind={onKind}
      sending={sending}
      onUpgrade={onUpgrade}
    />
  </HudSheet>
);

const nextPrice = (tier: Tier, prices: Record<2 | 3 | 4 | 5, number>): number | undefined =>
  tier === 5 ? undefined : prices[(tier + 1) as 2 | 3 | 4 | 5];

const AttributeRow = ({
  word,
  mark,
  state,
  price,
  affordable,
  chosen,
  onChoose,
}: {
  word: string;
  mark: IconMeaning;
  state: AttributeState;
  price: number | undefined;
  affordable: boolean;
  chosen: boolean;
  onChoose: () => void;
}) => (
  <HudRow
    lead={<SemanticIcon name={mark} size={26} />}
    title={word}
    detail={
      state.kinds && state.kinds.length > 0 ? (
        <span className="flex gap-0.5">
          {state.kinds.map((kind, index) => (
            <SemanticIcon key={index} name={KIND_ICONS[kind]} size={16} />
          ))}
        </span>
      ) : undefined
    }
    selected={chosen}
    onClick={onChoose}
    trail={
      <>
        <HudRarity tier={state.tier} />
        {price === undefined ? (
          <SemanticIcon name="check" size={22} />
        ) : (
          <HudChip tone={affordable ? "good" : "bad"}>
            {formatCharge(price)} {XP}
          </HudChip>
        )}
      </>
    }
  />
);

const ChosenTier = ({
  attribute,
  state,
  xp,
  price,
  effects,
  refills,
  refillOnBuy,
  kindRates,
  kind,
  onKind,
  sending,
  onUpgrade,
}: {
  attribute: AttributeKey;
  state: AttributeState;
  xp: number;
  price: number | undefined;
  effects: readonly [string, string, string, string, string];
  refills: number;
  refillOnBuy: number;
  kindRates: Record<ScoutKind, readonly [string, string]>;
  kind: ScoutKind;
  onKind: (kind: ScoutKind) => void;
  sending: boolean;
  onUpgrade: () => void;
}) => {
  const mark = MARKS[attribute];
  if (price === undefined)
    return (
      <div className="flex items-center justify-center gap-2">
        <HudRarity tier={5} word />
        <HudChip icons={[mark]} label={ATTRIBUTES[ATTRIBUTE_KEYS.indexOf(attribute)]}>
          {effects[4]}
        </HudChip>
        <SemanticIcon name="check" size={22} />
      </div>
    );
  const next = (state.tier + 1) as Tier;
  return (
    <>
      {attribute === "scouting" ? (
        <KindChoice rates={kindRates} lifted={kind} onKind={onKind} />
      ) : (
        <div className="flex items-center justify-center gap-2">
          <HudRarity tier={state.tier} word />
          <span aria-hidden className="text-hud-title text-hud-muted">
            →
          </span>
          <HudRarity tier={next} word />
        </div>
      )}
      <div className="flex items-center justify-center gap-2">
        {attribute !== "scouting" && (
          <HudChip
            icons={[mark]}
            label={ATTRIBUTES[ATTRIBUTE_KEYS.indexOf(attribute)]}
          >{`${effects[state.tier - 1]} → ${effects[next - 1]}`}</HudChip>
        )}
        <RefillFits refills={refills} of={refillOnBuy} />
      </div>
      {xp >= price ? (
        <>
          <HudButton kind="primary" busy={sending ? UPGRADING : undefined} onClick={onUpgrade}>
            {UPGRADE}
          </HudButton>
          <HudCost line={costLine([{ of: "xp", amount: price }])} />
        </>
      ) : (
        <HudNotice line={shortfallLine({ kind: "short", of: "xp", held: xp, need: price })} />
      )}
    </>
  );
};

/** What a purchase refills: all of it lit, or what fits large with the full amount small beside a full bar. */
const RefillFits = ({ refills, of }: { refills: number; of: number }) =>
  refills === of ? (
    <HudChip icons={["stamina"]} label={STAMINA}>{`+${formatExact(refills)}`}</HudChip>
  ) : (
    <span className="flex items-center gap-1.5">
      <HudChip icons={["stamina"]} label={STAMINA}>{`+${formatExact(refills)}`}</HudChip>
      <span className="text-hud-body tabular-nums text-hud-bad">{formatExact(of)}</span>
      <span className="w-10">
        <HudMeter share={1} tone="bad" label={FULL} />
      </span>
    </span>
  );

/** Scouting's choice: the kind this tier lifts, each with its find rate before and after; never ruins, shrines, wells. */
export const KindChoice = ({
  rates,
  lifted,
  onKind,
}: {
  rates: Record<ScoutKind, readonly [string, string]>;
  lifted: ScoutKind;
  onKind: (kind: ScoutKind) => void;
}) => (
  <div role="listbox" aria-label={ATTRIBUTES[2]} className="flex flex-col">
    {KINDS.map((kind, index) => (
      <HudRow
        key={kind}
        lead={<SemanticIcon name={KIND_ICONS[kind]} size={28} />}
        title={FIND_KINDS[index]}
        detail={`${rates[kind][0]} → ${rates[kind][1]}`}
        selected={kind === lifted}
        onClick={() => onKind(kind)}
      />
    ))}
  </div>
);
