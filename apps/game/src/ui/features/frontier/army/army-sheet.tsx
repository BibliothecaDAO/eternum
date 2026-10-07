import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip, FullIn } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import { ATTRIBUTES, FIND_KINDS, STAMINA, TROOPS, UPGRADE, UPGRADING, XP } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

export type AttributeKey = "battle" | "logistics" | "scouting" | "homecoming";
type ScoutKind = "camp" | "rift" | "stragglers";

const ATTRIBUTE_KEYS: AttributeKey[] = ["battle", "logistics", "scouting", "homecoming"];
const MARKS: Record<AttributeKey, IconCode> = { battle: "Ba", logistics: "Lg", scouting: "Sc", homecoming: "Su" };
const KIND_ICONS: Record<ScoutKind, IconCode> = { camp: "Cp", rift: "Rf", stragglers: "Tr" };
const KINDS: ScoutKind[] = ["camp", "rift", "stragglers"];

/** One attribute of the army: its tier, and for Scouting the kind each tier above common went to. */
type AttributeState = { tier: Tier; kinds?: readonly ScoutKind[] };

/**
 * The army (wireframe 08): its head (troops and XP, no level), its stamina against its own maximum with Full in and
 * the refill's place, its four attributes as rows (the Aspect's mark and word, the tier as frame and pips, the next
 * tier's XP price lit when affordable, a tick at legendary), then the chosen row: the tier now and next, what it
 * changes, the stamina a purchase refills (what fits of it), and Upgrade with the XP price, or the XP held against it.
 * Buying Scouting chooses its kind: camps, rifts or stragglers, each with its find rate before and after.
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
  art: string;
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
  <Sheet label={name} onClose={onClose}>
    <header className="flex h-11 items-center gap-2">
      <img src={art} alt="" className="size-10 rounded-full border border-kit-line2 object-cover" />
      <span className="truncate text-[16px] text-kit-cream">{name}</span>
      <Chip icons={["Tr"]} label={TROOPS} value={formatExact(troops)} />
      <span className="flex-1" />
      <span className="text-[24px] leading-none tabular-nums text-kit-gold2">{formatExact(xp)}</span>
      <span className="text-[14px] font-semibold text-kit-cream">{XP}</span>
    </header>
    <div className="flex h-12 items-center gap-2">
      <KitIcon code="St" size={22} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] tabular-nums text-kit-cream">
          {formatExact(stamina.current)} / {formatExact(stamina.max)}
        </span>
        <StoreBar amount={stamina.current} limit={stamina.max} tone="calm" />
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
  </Sheet>
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
  mark: IconCode;
  state: AttributeState;
  price: number | undefined;
  affordable: boolean;
  chosen: boolean;
  onChoose: () => void;
}) => (
  <button
    type="button"
    aria-pressed={chosen}
    aria-label={word}
    onClick={onChoose}
    className={cn(
      "frontier-card flex h-[52px] shrink-0 items-center gap-2 !rounded-xl px-2 text-left",
      chosen && "!border-2 !border-kit-hot",
    )}
  >
    <KitIcon code={mark} size={26} />
    <span className="text-[13px] font-semibold text-kit-cream">{word}</span>
    <span className="flex gap-0.5">
      {state.kinds?.map((kind, index) => (
        <KitIcon key={index} code={KIND_ICONS[kind]} size={16} />
      ))}
    </span>
    <span className="flex-1" />
    <TierChip tier={state.tier} showWord={false} />
    {price === undefined ? (
      <KitIcon code="Ok" size={22} />
    ) : affordable ? (
      <span data-tone="price" className="frontier-chip h-7 !py-0 !pl-2.5">
        <span className="contents">
          <span className="frontier-chip-number tabular-nums !text-[15px]">{formatExact(price)}</span>
          <span className="text-[13px] font-semibold text-kit-ink">{XP}</span>
        </span>
      </span>
    ) : (
      <span className="flex items-center gap-1 text-light-red">
        <span className="text-[15px] tabular-nums">{formatExact(price)}</span>
        <span className="text-[13px] font-semibold">{XP}</span>
      </span>
    )}
  </button>
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
        <TierChip tier={5} showWord />
        <Chip icons={[mark]} label={ATTRIBUTES[ATTRIBUTE_KEYS.indexOf(attribute)]} value={effects[4]} />
        <KitIcon code="Ok" size={22} />
      </div>
    );
  const next = (state.tier + 1) as Tier;
  return (
    <>
      {attribute === "scouting" ? (
        <KindChoice rates={kindRates} lifted={kind} onKind={onKind} />
      ) : (
        <div className="flex items-center justify-center gap-2">
          <TierChip tier={state.tier} showWord />
          <span aria-hidden className="text-[18px] text-kit-muted">
            →
          </span>
          <TierChip tier={next} showWord />
        </div>
      )}
      <div className="flex items-center justify-center gap-2">
        {attribute !== "scouting" && (
          <Chip
            icons={[mark]}
            label={ATTRIBUTES[ATTRIBUTE_KEYS.indexOf(attribute)]}
            value={`${effects[state.tier - 1]} → ${effects[next - 1]}`}
          />
        )}
        <RefillFits refills={refills} of={refillOnBuy} />
      </div>
      {xp >= price ? (
        <Button
          role="primary"
          word={UPGRADE}
          prices={[{ of: "xp", amount: price }]}
          loading={sending ? UPGRADING : undefined}
          onClick={onUpgrade}
        />
      ) : (
        <ReasonPlate reason={{ kind: "short", icon: "Ey", held: xp, need: price, unit: XP }} />
      )}
    </>
  );
};

/** What a purchase refills: all of it lit, or what fits large with the full amount small beside a full bar. */
const RefillFits = ({ refills, of }: { refills: number; of: number }) =>
  refills === of ? (
    <Chip icons={["St"]} label={STAMINA} value={`+${formatExact(refills)}`} />
  ) : (
    <span className="flex items-center gap-1.5">
      <Chip icons={["St"]} label={STAMINA} value={`+${formatExact(refills)}`} />
      <span className="text-[14px] tabular-nums text-light-red">{formatExact(of)}</span>
      <span className="w-10">
        <StoreBar amount={1} limit={1} tone="ember" />
      </span>
    </span>
  );

/** Scouting's choice: the kind this tier lifts, each with its find rate before and after; never ruins, shrines, wells. */
const KindChoice = ({
  rates,
  lifted,
  onKind,
}: {
  rates: Record<ScoutKind, readonly [string, string]>;
  lifted: ScoutKind;
  onKind: (kind: ScoutKind) => void;
}) => (
  <div role="radiogroup" className="flex gap-2">
    {KINDS.map((kind, index) => (
      <button
        key={kind}
        type="button"
        role="radio"
        aria-checked={kind === lifted}
        aria-label={FIND_KINDS[index]}
        onClick={() => onKind(kind)}
        className={cn(
          "frontier-card flex h-[76px] flex-1 flex-col items-center justify-center gap-1 !rounded-xl",
          kind === lifted && "!border-[3px] !border-kit-hot",
        )}
      >
        <KitIcon code={KIND_ICONS[kind]} size={28} />
        <span className="flex items-baseline gap-[3px] tabular-nums text-kit-cream">
          <span className="text-[14px]">{rates[kind][0]}</span>
          <span className="text-[14px]">→</span>
          <span className="text-[15px] text-kit-gold2">{rates[kind][1]}</span>
        </span>
      </button>
    ))}
  </div>
);
