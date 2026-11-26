import "./deep-site.css";

import type { ReactNode } from "react";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { type Price } from "@/ui/design-system/kit/price-faces";
import {
  HudButton,
  HudMeter,
  HudPrice,
  HudNotice,
  HudRow,
  HudSheet,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { ARMY, DEEP_WORDS, MOVE, TROOPS } from "@/ui/design-system/kit/words";
import {
  aspectName,
  type AspectId,
  DEEP_BEASTS,
  type Troops,
  beastModel,
  deepSites,
  formatExact,
  formatRate,
  formatShortDuration,
} from "@bibliothecadao/types";
import { beastMeaning, troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { nativeRuleConstants } from "../../../../../../../contracts/l3/world-native/schema/balance.gen";

import { AttackStamina, FightArena } from "../sites/fight-side";
import { BeastMarkBadge, combatMarkOf } from "../sites/combat-mark";
import type { DeepSiteFight } from "../sites/site-card-plan";

import { DEEP_SITE_FACES } from "./deep-site-faces";

export interface DeepRates {
  tickSeconds: number;
  glory: number;
  height: number;
  essence: number;
  labor: number;
  bar: { perTick: number; charge: number; threshold: number } | null;
  drain: number;
}

export type DeepPay = keyof typeof DEEP_WORDS.kinds;

export interface DeepOpening {
  entered: number;
  realms: number;
  pays: readonly DeepPay[];
}

export interface DeepSlot {
  slot: number;
  category: Troops["category"];
  tier: Troops["tier"];
  realm: string;
  troops: number;
  lossPerTick: number;
  ticks: { left: number; time: string };
  share: number;
  mine: boolean;
}

export type DeepGuard =
  | { kind: "beast"; troops: number; category: Troops["category"] }
  | {
      kind: "held";
      aspectId: AspectId;
      side: "own" | "ally" | "rival";
      slots: readonly DeepSlot[];
      next: number | undefined;
    }
  | { kind: "open" };

export type DeepBlock = "pickArmy" | "guarding" | "ownerOnly" | "rival" | "otherDay" | "noTroops";

export type DeepOrder =
  | { kind: "act"; verb: "attack" | "take"; stamina?: number; busy?: string; onAct: () => void }
  | { kind: "short"; verb: "attack"; line: string }
  | { kind: "move"; prices: readonly Price[]; onMove: () => void }
  | { kind: "closed" };

export interface DeepSiteProps {
  site: (typeof deepSites)[number]["key"];
  ring: number;
  rates: DeepRates | null;
  opening: DeepOpening | null;
  guard: DeepGuard;
  fight?: DeepSiteFight;
  order: DeepOrder | DeepBlock;
  transfers?: ReactNode;
  onClose: () => void;
}

const FIGHT_ORDER = Array.from(
  { length: nativeRuleConstants.DEEP_GUARD_SLOTS },
  (_, index) => nativeRuleConstants.DEEP_GUARD_SLOTS - 1 - index,
);

const siteName = (key: DeepSiteProps["site"]) => deepSites.find((each) => each.key === key)!.name;

export const DeepSiteView = ({
  site,
  ring,
  rates,
  opening,
  guard,
  fight,
  order,
  transfers,
  onClose,
}: DeepSiteProps) => {
  const name = siteName(site);
  const secondary = rates && secondaryRate(rates);
  return (
    <HudSheet
      label={name}
      title={<DeepTitle site={site} name={name} tag={siteTag(ring, opening, guard)} />}
      onClose={onClose}
    >
      <div data-deep-site={site} data-deep-guard={guard.kind} className="deep-site">
        {rates ? <RateStrip rates={rates} /> : opening && <LockedKinds pays={opening.pays} />}
        {fight ? <FightPreview site={site} fight={fight} guard={guard} /> : <GuardStrip site={site} guard={guard} />}
        {fight && guard.kind === "held" && <GuardStrip site={site} guard={guard} />}
        {rates && secondary?.kind !== "drain" && <PoisonStrip rates={rates} />}
        {opening && <OpeningBar opening={opening} />}
      </div>
      {transfers ?? <OrderFoot order={order} />}
      {typeof order === "object" && order.kind === "short" && <HudNotice tone="bad" line={order.line} />}
    </HudSheet>
  );
};

type SiteTag = { state: "open" | "held" | "locked" | "rival"; line: string; aspectId?: AspectId };

const siteTag = (ring: number, opening: DeepSiteProps["opening"], guard: DeepGuard): SiteTag => {
  const shownRing = ring + 1;
  if (opening) return { state: "locked", line: DEEP_WORDS.tag.locked(shownRing) };
  if (guard.kind !== "held") return { state: "open", line: DEEP_WORDS.tag.open(shownRing) };
  const aspect = aspectName(guard.aspectId);
  return guard.side !== "rival"
    ? { state: "held", line: DEEP_WORDS.tag.held(aspect), aspectId: guard.aspectId }
    : {
        state: "rival",
        line: DEEP_WORDS.tag.rival(aspect, guard.slots.length, nativeRuleConstants.DEEP_GUARD_SLOTS),
        aspectId: guard.aspectId,
      };
};

const DeepTitle = ({ site, name, tag }: { site: DeepSiteProps["site"]; name: string; tag: SiteTag }) => (
  <span className="deep-title">
    <span className="deep-title__emblem">
      <Icon name={DEEP_SITE_FACES[site].icon} size={26} />
    </span>
    <span className="deep-title__words">
      <span data-deep-tag={tag.state} data-aspect-id={tag.aspectId} className="deep-tag">
        {tag.line}
      </span>
      <span className="deep-title__name">{name}</span>
      <span className="deep-title__purpose">{DEEP_SITE_FACES[site].purpose}</span>
    </span>
  </span>
);

type Rate = { kind: "glory" | "height" | "essence" | "labor" | "bar" | "drain"; amount: number; sub: string };

const cadenceOf = (rates: DeepRates) => formatShortDuration(rates.tickSeconds);

const resourceSub = (rates: DeepRates, amount: number) => DEEP_WORDS.splitCell(formatRate(amount / rates.tickSeconds));

const primaryRate = (rates: DeepRates): Rate | null =>
  rates.glory > 0
    ? { kind: "glory", amount: rates.glory, sub: DEEP_WORDS.splitCell(DEEP_WORDS.kinds.glory) }
    : rates.essence > 0
      ? { kind: "essence", amount: rates.essence, sub: resourceSub(rates, rates.essence) }
      : rates.labor > 0
        ? { kind: "labor", amount: rates.labor, sub: resourceSub(rates, rates.labor) }
        : null;

const secondaryRate = (rates: DeepRates): Rate =>
  rates.height > 0
    ? { kind: "height", amount: rates.height, sub: DEEP_WORDS.kinds.height }
    : rates.bar
      ? { kind: "bar", amount: rates.bar.perTick, sub: DEEP_WORDS.kinds.bar }
      : { kind: "drain", amount: rates.drain, sub: DEEP_WORDS.poisonCell };

const RATE_ICONS = {
  glory: "crown",
  height: "hyperstructure",
  essence: "essence",
  labor: "labor",
  bar: "flame",
  drain: "poison",
} as const satisfies Record<Rate["kind"], IconMeaning>;

const RateStrip = ({ rates }: { rates: DeepRates }) => {
  const cells = [primaryRate(rates), secondaryRate(rates)].flatMap((rate) => (rate ? [rate] : []));
  return (
    <div data-deep-pay className="deep-rates">
      {cells.map((rate) => (
        <span
          key={rate.kind}
          data-rate={rate.kind}
          data-tip={
            rate.kind === "bar" && rates.bar ? DEEP_WORDS.bar(rates.bar.charge, rates.bar.threshold) : undefined
          }
          className="deep-rate"
        >
          <span className="deep-rate__value">
            <Icon name={RATE_ICONS[rate.kind]} size={18} />
            <b data-tone={rate.kind === "drain" ? "poison" : undefined}>
              {rate.kind === "drain" ? `−${formatExact(rate.amount)}` : `+${formatExact(rate.amount)}`}
            </b>
            <i>{DEEP_WORDS.perTick(cadenceOf(rates))}</i>
          </span>
          <span className="deep-rate__sub">{rate.sub}</span>
        </span>
      ))}
    </div>
  );
};

const LockedKinds = ({ pays }: { pays: readonly DeepPay[] }) => (
  <div data-deep-kinds className="deep-kinds">
    {pays.map((kind) => (
      <span key={kind} className="deep-kinds__kind">
        <Icon name={RATE_ICONS[kind]} size={16} />
        {DEEP_WORDS.kinds[kind]}
      </span>
    ))}
    <span className="deep-kinds__note">{DEEP_WORDS.ratesWhenOpen}</span>
  </div>
);

const PoisonStrip = ({ rates }: { rates: DeepRates }) => (
  <span data-deep-poison className="deep-poison-strip">
    <Icon name="poison" size={14} />
    {DEEP_WORDS.poisonStrip(rates.drain, cadenceOf(rates))}
  </span>
);

const OpeningBar = ({ opening }: { opening: DeepOpening }) => (
  <div data-deep-opening className="deep-opening">
    <span className="deep-opening__line">
      <Icon name="lock" size={14} />
      <span className="flex-1">{DEEP_WORDS.opensAt(opening.realms)}</span>
      <b>{DEEP_WORDS.entered(opening.entered, opening.realms)}</b>
    </span>
    <HudMeter
      share={opening.realms > 0 ? Math.min(1, opening.entered / opening.realms) : 1}
      label={DEEP_WORDS.opensAt(opening.realms)}
    />
  </div>
);

const FightPreview = ({
  site,
  fight,
  guard,
}: {
  site: DeepSiteProps["site"];
  fight: DeepSiteFight;
  guard: DeepGuard;
}) => {
  const result = fight.result && !("refused" in fight.result) ? fight.result : undefined;
  const frontGuard = guard.kind === "held" ? guard.slots.find((each) => each.slot === guard.next) : undefined;
  const defenderLabel = guard.kind === "beast" ? DEEP_BEASTS[site].name : (frontGuard?.realm ?? TROOPS);
  const defenderArt =
    guard.kind === "beast" ? beastMeaning(beastModel(DEEP_BEASTS[site])) : troopMeaning(fight.defenderTroops);
  const defenderBadge =
    guard.kind === "beast" ? (
      <BeastMarkBadge category={guard.category} />
    ) : guard.kind === "held" ? (
      <span className="deep-fight__aspect" aria-hidden="true">
        <AspectMark aspect={guard.aspectId} size={14} decorative />
      </span>
    ) : null;
  return (
    <FightArena
      ours={{
        label: ARMY,
        mark: <Icon name={troopMeaning(fight.attackerTroops)} size={96} className="size-full" />,
        before: fight.army,
        kept: result && fight.army - result.troopsLost,
      }}
      theirs={{
        label: defenderLabel,
        mark: (
          <span className="relative block size-full">
            <Icon name={defenderArt} size={96} className="size-full" />
            {defenderBadge}
          </span>
        ),
        before: fight.defender,
        kept: result?.guardLeft,
      }}
    />
  );
};

const slotTip = (slot: DeepSlot, next: boolean): string =>
  [
    next ? `${slot.realm} · ${DEEP_WORDS.facesNext}` : slot.realm,
    formatExact(slot.troops),
    DEEP_WORDS.drainTick(slot.lossPerTick),
    DEEP_WORDS.lasts(slot.ticks.left, slot.ticks.time),
    DEEP_WORDS.share(slot.share),
  ].join(" · ");

const BeastRow = ({ site, guard }: { site: DeepSiteProps["site"]; guard: Extract<DeepGuard, { kind: "beast" }> }) => (
  <div data-deep-beast className="deep-beast">
    <span className="deep-beast__portrait">
      <Icon name={beastMeaning(beastModel(DEEP_BEASTS[site]))} size={48} className="size-full" />
      <BeastMarkBadge category={guard.category} />
    </span>
    <span className="deep-beast__words">
      <span className="deep-beast__name">
        {DEEP_BEASTS[site].name}
        <span className="deep-beast__tag">{combatMarkOf(guard.category).label}</span>
      </span>
      <b className="deep-beast__troops">{DEEP_WORDS.troops(guard.troops)}</b>
    </span>
  </div>
);

const GuardStrip = ({ site, guard }: { site: DeepSiteProps["site"]; guard: DeepGuard }) => {
  if (guard.kind === "beast") return <BeastRow site={site} guard={guard} />;
  if (guard.kind === "open") return <HudRow lead={<Icon name="flag" size={32} />} title={DEEP_WORDS.open} />;
  const filled = FIGHT_ORDER.flatMap((slot) => {
    const held = guard.slots.find((each) => each.slot === slot);
    return held ? [held] : [];
  });
  const free = FIGHT_ORDER.filter((slot) => !guard.slots.some((each) => each.slot === slot));
  return (
    <div data-deep-slots className="deep-held">
      <div
        className="deep-holder"
        data-aspect-holder={guard.aspectId}
        data-aspect-id={guard.aspectId}
        data-side={guard.side}
      >
        <AspectMark aspect={guard.aspectId} size={16} decorative />
        <span className={guard.side === "rival" ? "text-hud-bad" : "text-hud-ally"}>{aspectName(guard.aspectId)}</span>
        <span>
          · {DEEP_WORDS.guardsCount(guard.slots.length, nativeRuleConstants.DEEP_GUARD_SLOTS)} ·{" "}
          {DEEP_WORDS.slotsOpen(free.length)}
          {filled.length > 0 && " · "}
        </span>
        {filled.length > 0 && (
          <span data-deep-poisoned className="deep-poisoned">
            {DEEP_WORDS.poisoned}
          </span>
        )}
      </div>
      <div className="deep-guards">
        <div className="deep-guards__row">
          {filled.map((held) => {
            const isNext = held.slot === guard.next;
            const tip = slotTip(held, isNext);
            return (
              <span
                key={held.slot}
                data-deep-slot="filled"
                data-next={isNext || undefined}
                data-mine={held.mine || undefined}
                data-tip={tip}
                role="img"
                aria-label={tip}
                className="deep-guard-portrait"
              >
                <Icon
                  name={troopMeaning({ category: held.category, tier: held.tier })}
                  size={44}
                  className="size-full"
                />
                <span className="deep-guard-portrait__poison" aria-hidden="true">
                  <Icon name="poison" size={12} />
                </span>
                <span className="deep-guard-portrait__aspect" aria-hidden="true">
                  <AspectMark aspect={guard.aspectId} size={16} decorative />
                </span>
              </span>
            );
          })}
          {free.map((slot) => (
            <span
              key={slot}
              data-deep-slot="empty"
              aria-label={DEEP_WORDS.freeSlot}
              data-tip={DEEP_WORDS.freeSlot}
              className="deep-guard-empty"
            >
              <Icon name="plus" size={16} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const OrderFoot = ({ order }: { order: DeepOrder | DeepBlock }) => {
  if (typeof order === "string") return <HudWindowFoot note={DEEP_WORDS[order]} />;
  if (order.kind === "closed") return null;
  const footPrices = order.kind === "move" ? order.prices : undefined;
  return (
    <HudWindowFoot note={footPrices ? <HudPrice prices={footPrices} /> : undefined}>
      {order.kind === "act" && (
        <HudButton
          kind="primary"
          icon={order.verb === "attack" ? "attack" : undefined}
          aria-label={order.busy ? undefined : DEEP_WORDS[order.verb]}
          busy={order.busy}
          onClick={order.onAct}
        >
          {DEEP_WORDS[order.verb]}
          {order.stamina !== undefined && order.stamina > 0 && <AttackStamina stamina={order.stamina} />}
        </HudButton>
      )}
      {order.kind === "short" && (
        <HudButton kind="primary" icon="attack" disabled>
          {DEEP_WORDS[order.verb]}
        </HudButton>
      )}
      {order.kind === "move" && (
        <HudButton kind="primary" icon="move" onClick={order.onMove}>
          {MOVE}
        </HudButton>
      )}
    </HudWindowFoot>
  );
};
