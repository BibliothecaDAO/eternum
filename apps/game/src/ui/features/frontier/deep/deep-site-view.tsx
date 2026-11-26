import "./deep-site.css";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { useHudLayout } from "@/hooks/helpers/use-compact-hud";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { type Price } from "@/ui/design-system/kit/price-faces";
import {
  AmountInput,
  HudButton,
  HudMeter,
  HudPrice,
  HudNotice,
  HudSheet,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { AmountRange } from "../amount-range";
import { ARMY, DEEP_WORDS, MOVE, SLOT_ADD, SLOT_EMPTY, UNDEFENDED, YOU } from "@/ui/design-system/kit/words";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Fragment, useState, type ReactNode } from "react";
import {
  aspectName,
  type AspectId,
  DEEP_BEASTS,
  type Troops,
  beastModel,
  deepSites,
  formatExact,
  formatShortDuration,
  frontierTroopName,
} from "@bibliothecadao/types";
import { beastMeaning, troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { nativeRuleConstants } from "@bibliothecadao/eternum/game-client";

import { AttackStamina, FightArena } from "../sites/fight-side";
import { BeastMarkBadge, combatMarkOf } from "../sites/combat-mark";
import type { DeepSiteFight } from "../sites/site-card-plan";

import { DEEP_SITE_FACES, type DeepPay } from "./deep-site-faces";

export interface DeepRates {
  tickSeconds: number;
  glory: number;
  height: number;
  essence: number;
  labor: number;
  bar: { perTick: number; charge: number; threshold: number } | null;
  drain: number;
}

export interface DeepOpening {
  entered: number;
  realms: number;
  pays: readonly DeepPay[];
}

export type DeepSide = "own" | "ally" | "rival" | "held";

export interface DeepGarrisonSlot {
  slot: number;
  owner: string;
  aspectId: AspectId;
  side: DeepSide;
  troops: Pick<Troops, "category" | "tier">;
  count: number;
  cap: number;
  share: number;
  timeLeft: string;
}

export type DeepGuard =
  | { kind: "beast"; troops: number; category: Troops["category"] }
  | { kind: "open" }
  | {
      kind: "taken";
      owner: string;
      aspectId: AspectId;
      side: DeepSide;
      slots: readonly DeepGarrisonSlot[];
      mayAdd: boolean;
      alliesMayGuard: boolean;
      gloryWon: number | undefined;
    };

export type DeepBlock = "pickArmy" | "otherDay" | "noTroops" | "noAdjacent" | "slotsFull" | "ownerOnly";

export type DeepTransfer = { most: number; onSend: (amount: number, targetSlot?: number) => void };

export type DeepOrder =
  | { kind: "attack"; verb: "attack" | "take"; stamina?: number; busy?: string; onAct: () => void }
  | { kind: "short"; line: string }
  | {
      kind: "guard";
      troops: Pick<Troops, "category" | "tier">;
      armyTroops: number;
      busy?: string;
      guard?: DeepTransfer;
      withdraw?: DeepTransfer;
    }
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
  onClose: () => void;
}

type Taken = Extract<DeepGuard, { kind: "taken" }>;
type Picking = { kind: "guard" | "withdraw"; targetSlot?: number };

const SLOTS = nativeRuleConstants.DEEP_GUARD_SLOTS;
const FIGHT_SLOTS = Array.from({ length: SLOTS }, (_, index) => SLOTS - 1 - index);

const siteName = (key: DeepSiteProps["site"]) => deepSites.find((each) => each.key === key)!.name;

export const DeepSiteView = ({ site, ring, rates, opening, guard, fight, order, onClose }: DeepSiteProps) => {
  const name = siteName(site);
  const [picking, setPicking] = useState<Picking | null>(null);
  const orders = typeof order === "object" && order.kind === "guard" ? order : undefined;
  const pick = (want: Picking["kind"], targetSlot?: number) => {
    const chosen =
      want === "withdraw" ? (orders?.withdraw ? "withdraw" : "guard") : orders?.guard ? "guard" : "withdraw";
    const available = chosen === "withdraw" ? orders?.withdraw : orders?.guard;
    if (!available) return;
    setPicking({ kind: chosen, targetSlot });
  };
  const activeTransfer = picking ? (picking.kind === "withdraw" ? orders?.withdraw : orders?.guard) : undefined;
  return (
    <HudSheet
      label={name}
      title={<DeepTitle site={site} name={name} tag={siteTag(ring, opening, guard)} guard={guard} />}
      onClose={onClose}
    >
      <div data-deep-site={site} data-deep-guard={guard.kind} className="deep-site">
        <div className="deep-yield">
          {rates ? <RateStrip rates={rates} guard={guard} /> : opening && <LockedKinds pays={opening.pays} />}
          <p className="deep-purpose">{DEEP_SITE_FACES[site].purpose}</p>
        </div>
        {fight && <FightPreview site={site} fight={fight} guard={guard} />}
        {opening ? (
          <OpeningBar opening={opening} />
        ) : (
          <GuardRow site={site} guard={guard} rates={rates} orders={orders} onPick={orders ? pick : undefined} />
        )}
        {orders && picking && activeTransfer && (
          <TransferPicker
            key={`${picking.kind}:${picking.targetSlot ?? "auto"}:${activeTransfer.most}`}
            orders={orders}
            picking={picking}
            transfer={activeTransfer}
            onDone={() => setPicking(null)}
          />
        )}
        {rates && guard.kind === "taken" && (
          <p data-deep-day-end className="deep-day-end-warn">
            {DEEP_WORDS.dayEndPoison(rates.drain, cadenceOf(rates))} · <b>{DEEP_WORDS.dayEndLost}</b>
          </p>
        )}
      </div>
      <OrderFoot order={order} guard={guard} site={site} onPick={pick} />
      {typeof order === "object" && order.kind === "short" && <HudNotice tone="bad" line={order.line} />}
    </HudSheet>
  );
};

type SiteTag = { state: DeepSide | "open" | "locked"; line: string };

const siteTag = (ring: number, opening: DeepSiteProps["opening"], guard: DeepGuard): SiteTag => {
  const shownRing = ring + 1;
  if (opening) return { state: "locked", line: DEEP_WORDS.tag.locked(shownRing) };
  if (guard.kind !== "taken") return { state: "open", line: DEEP_WORDS.tag.open(shownRing) };
  return {
    state: guard.side,
    line: DEEP_WORDS.tag[guard.side](aspectName(guard.aspectId), guard.slots.length, SLOTS),
  };
};

const DeepTitle = ({
  site,
  name,
  tag,
  guard,
}: {
  site: DeepSiteProps["site"];
  name: string;
  tag: SiteTag;
  guard: DeepGuard;
}) => (
  <span className="deep-title">
    <span className="deep-title__emblem">
      <Icon name={DEEP_SITE_FACES[site].icon} size={24} />
    </span>
    <span className="deep-title__words">
      <span data-deep-tag={tag.state} className="deep-tag">
        {tag.line}
      </span>
      <span className="deep-title__name">{name}</span>
      {guard.kind === "taken" && (
        <span data-deep-holder className="deep-title__holder">
          <AspectMark aspect={guard.aspectId} size={13} decorative />
          <span>
            {DEEP_WORDS.heldBy} <b>{guard.owner}</b> · {aspectName(guard.aspectId)}
          </span>
        </span>
      )}
    </span>
  </span>
);

type Rate = { kind: "glory" | "height" | "essence" | "labor" | "bar"; amount: number };

const cadenceOf = (rates: DeepRates) => formatShortDuration(rates.tickSeconds);

const ratesOf = (rates: DeepRates): Rate[] =>
  (
    [
      { kind: "glory", amount: rates.glory },
      { kind: "essence", amount: rates.essence },
      { kind: "labor", amount: rates.labor },
      { kind: "height", amount: rates.height },
      { kind: "bar", amount: rates.bar?.perTick ?? 0 },
    ] as const
  ).filter((rate) => rate.amount > 0);

const RATE_ICONS = {
  glory: "crown",
  height: "hyperstructure",
  essence: "essence",
  labor: "labor",
  bar: "flame",
} as const satisfies Record<Rate["kind"], IconMeaning>;

const RateStrip = ({ rates, guard }: { rates: DeepRates; guard: DeepGuard }) => {
  const list = ratesOf(rates);
  return (
    <div data-deep-pay className="deep-rates">
      {list.map((rate, index) => (
        <Fragment key={rate.kind}>
          {index > 0 && (
            <span className="deep-rates__dot" aria-hidden="true">
              ·
            </span>
          )}
          <span data-rate={rate.kind} data-tip={DEEP_WORDS.kinds[rate.kind]} className="deep-rate">
            <Icon name={RATE_ICONS[rate.kind]} size={15} />
            <b>{`+${formatExact(rate.amount)}`}</b>
            <i>{DEEP_WORDS.perTick(cadenceOf(rates))}</i>
            {rate.kind === "bar" && rates.bar && <i>{`· ${DEEP_WORDS.bar(rates.bar.charge, rates.bar.threshold)}`}</i>}
          </span>
        </Fragment>
      ))}
      {guard.kind === "taken" && <GloryWon rates={rates} guard={guard} />}
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

const viewerShare = (guard: Taken) =>
  guard.slots.filter((slot) => slot.side === "own").reduce((sum, slot) => sum + slot.share, 0);

const GloryWon = ({ rates, guard }: { rates: DeepRates; guard: Taken }) => {
  if (rates.glory <= 0 || guard.gloryWon === undefined) return null;
  if (guard.side !== "own" && guard.side !== "ally") return null;
  const share = viewerShare(guard);
  const tip =
    share > 0
      ? DEEP_WORDS.gloryTip(Math.round(rates.glory * share) / 100, cadenceOf(rates), share)
      : DEEP_WORDS.gloryIdleTip;
  return (
    <span data-deep-glory-won data-tip={tip} className="deep-glory-won">
      <Icon name="crown" size={13} />
      {DEEP_WORDS.glory(guard.gloryWon)}
    </span>
  );
};

const inFightOrder = (slots: readonly DeepGarrisonSlot[]) => [...slots].sort((left, right) => right.slot - left.slot);

const matchesOwnArmy = (slot: DeepGarrisonSlot, troops: Pick<Troops, "category" | "tier">) =>
  slot.side === "own" && slot.troops.category === troops.category && slot.troops.tier === troops.tier;

const GuardRow = ({
  site,
  guard,
  rates,
  orders,
  onPick,
}: {
  site: DeepSiteProps["site"];
  guard: DeepGuard;
  rates: DeepRates | null;
  orders: Extract<DeepOrder, { kind: "guard" }> | undefined;
  onPick: ((want: Picking["kind"], targetSlot?: number) => void) | undefined;
}) => {
  const held = guard.kind === "taken" ? inFightOrder(guard.slots) : [];
  const filled = guard.kind === "beast" ? 1 : held.length;
  const cue =
    guard.kind === "taken" && held.length === 0
      ? UNDEFENDED
      : guard.kind === "taken" && guard.side === "rival"
        ? DEEP_WORDS.slotOrder.seize
        : DEEP_WORDS.slotOrder.cue;
  const occupied = new Set(held.map((slot) => slot.slot));
  const emptySlots =
    guard.kind === "taken"
      ? FIGHT_SLOTS.filter((slot) => !occupied.has(slot))
      : Array.from({ length: SLOTS - filled }, (_, index) => index);
  const hasOwnMatchingSlot = orders !== undefined && held.some((slot) => matchesOwnArmy(slot, orders.troops));
  const canAdd = Boolean(orders?.guard && onPick && !hasOwnMatchingSlot);
  const showUndefended =
    guard.kind === "taken" && held.length === 0 && (guard.side === "own" || (guard.side === "ally" && guard.mayAdd));
  return (
    <div data-deep-guards className="deep-guards">
      <div className="deep-guards__head">
        <span>{DEEP_WORDS.guardCount(filled, SLOTS)}</span>
        <span className="deep-guards__cue">{cue}</span>
      </div>
      <div className="deep-guards__row">
        {guard.kind === "beast" && <BeastTile site={site} guard={guard} />}
        {held.map((slot, index) => {
          const interactive =
            orders !== undefined &&
            matchesOwnArmy(slot, orders.troops) &&
            Boolean(onPick) &&
            Boolean(orders.withdraw || orders.guard);
          return (
            <GuardTile
              key={slot.slot}
              slot={slot}
              first={index === 0}
              rates={rates}
              onOpen={interactive ? () => onPick!(orders?.withdraw ? "withdraw" : "guard", slot.slot) : undefined}
            />
          );
        })}
        {emptySlots.map((slotNumber) => (
          <EmptyTile key={slotNumber} guard={guard} onAdd={canAdd ? () => onPick!("guard", slotNumber) : undefined} />
        ))}
      </div>
      {showUndefended && (
        <p data-deep-undefended className="deep-guards__undefended">
          {DEEP_WORDS.undefendedLine}
        </p>
      )}
    </div>
  );
};

const Tile = ({
  onPress,
  tip,
  className,
  children,
  ...data
}: {
  onPress: (() => void) | undefined;
  tip: string;
  className: string;
  children: ReactNode;
} & Record<`data-${string}`, string | number | boolean | undefined>) =>
  onPress ? (
    <button
      type="button"
      data-tip={tip}
      aria-label={tip}
      className={cn("ui-pick", className)}
      onClick={onPress}
      {...data}
    >
      {children}
    </button>
  ) : (
    <span role="img" data-tip={tip} aria-label={tip} className={className} {...data}>
      {children}
    </span>
  );

const BeastTile = ({ site, guard }: { site: DeepSiteProps["site"]; guard: Extract<DeepGuard, { kind: "beast" }> }) => (
  <Tile
    onPress={undefined}
    tip={DEEP_WORDS.beastTip(DEEP_BEASTS[site].name, combatMarkOf(guard.category).label)}
    className="deep-tile"
    data-deep-beast=""
    data-first=""
  >
    <span className="deep-tile__first">{DEEP_WORDS.slotOrder.first}</span>
    <span className="deep-tile__portrait">
      <Icon name={beastMeaning(beastModel(DEEP_BEASTS[site]))} size={32} className="size-full" />
      <BeastMarkBadge category={guard.category} />
    </span>
    <b className="deep-tile__count">{formatExact(guard.troops)}</b>
    <span className="deep-tile__owner">{DEEP_BEASTS[site].name}</span>
  </Tile>
);

const GuardTile = ({
  slot,
  first,
  rates,
  onOpen,
}: {
  slot: DeepGarrisonSlot;
  first: boolean;
  rates: DeepRates | null;
  onOpen: (() => void) | undefined;
}) => {
  const owner = slot.side === "own" ? YOU : slot.owner;
  const cadence = rates ? cadenceOf(rates) : "";
  const drain = rates ? DEEP_WORDS.slotDrain(rates.drain, cadence) : undefined;
  const gloryRate = rates && rates.glory > 0 && slot.share > 0 ? Math.round(rates.glory * slot.share) / 100 : undefined;
  return (
    <Tile
      onPress={onOpen}
      tip={DEEP_WORDS.slotTip(
        owner,
        frontierTroopName(slot.troops.category) ?? "",
        slot.count,
        slot.cap,
        slot.share,
        rates?.drain ?? 0,
        cadence,
        slot.timeLeft,
        Boolean(onOpen),
        gloryRate,
      )}
      className="deep-tile"
      data-guard-slot={slot.slot}
      data-share={slot.share}
      data-side={slot.side}
      data-first={first || undefined}
    >
      {first && <span className="deep-tile__first">{DEEP_WORDS.slotOrder.first}</span>}
      <span className="deep-tile__portrait">
        <Icon name={troopMeaning(slot.troops)} size={32} className="size-full" />
        <BeastMarkBadge category={slot.troops.category} />
      </span>
      <b className="deep-tile__count">{formatExact(slot.count)}</b>
      <span className="deep-tile__owner">{owner}</span>
      {drain && <span className="deep-tile__drain">{drain}</span>}
    </Tile>
  );
};

const emptyTip = (guard: DeepGuard) =>
  guard.kind !== "taken"
    ? SLOT_EMPTY
    : !guard.mayAdd
      ? DEEP_WORDS.ownerOnly
      : guard.alliesMayGuard
        ? DEEP_WORDS.openSlotTip(aspectName(guard.aspectId))
        : DEEP_WORDS.openOwnerSlotTip;

const EmptyTile = ({ guard, onAdd }: { guard: DeepGuard; onAdd: (() => void) | undefined }) => (
  <Tile onPress={onAdd} tip={emptyTip(guard)} className="deep-tile" data-empty={onAdd ? "add" : "empty"}>
    {onAdd && <Icon name="plus" size={14} />}
    <span className="deep-tile__empty">{onAdd ? SLOT_ADD : SLOT_EMPTY}</span>
  </Tile>
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
  const front = guard.kind === "taken" ? inFightOrder(guard.slots)[0] : undefined;
  const defenderLabel = guard.kind === "beast" ? DEEP_BEASTS[site].name : (front?.owner ?? siteName(site));
  const defenderArt =
    guard.kind === "beast" ? beastMeaning(beastModel(DEEP_BEASTS[site])) : troopMeaning(fight.defenderTroops);
  const defenderBadge =
    guard.kind === "beast" ? (
      <BeastMarkBadge category={guard.category} />
    ) : guard.kind === "taken" ? (
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

const TransferPicker = ({
  orders,
  picking,
  transfer,
  onDone,
}: {
  orders: Extract<DeepOrder, { kind: "guard" }>;
  picking: Picking;
  transfer: DeepTransfer;
  onDone: () => void;
}) => {
  const [amount, setAmount] = useState(0);
  const withdrawing = picking.kind === "withdraw";
  const label = withdrawing ? DEEP_WORDS.withdraw : DEEP_WORDS.guardWith(frontierTroopName(orders.troops.category));
  const confirm = () => {
    transfer.onSend(amount, picking.targetSlot);
    onDone();
  };
  const confirmLabel = withdrawing
    ? amount > 0
      ? DEEP_WORDS.withdrawAmount(amount)
      : DEEP_WORDS.withdraw
    : amount > 0
      ? DEEP_WORDS.guardAmount(amount)
      : DEEP_WORDS.guardShort;
  return (
    <div data-deep-transfer={picking.kind} className="deep-transfer">
      <div className="deep-transfer__row">
        <AmountInput label={label} value={amount} max={transfer.most} onChange={setAmount} />
        <span className="flex-1">
          <AmountRange
            label={label}
            icon={troopMeaning(orders.troops)}
            value={amount}
            max={transfer.most}
            onChange={setAmount}
          />
        </span>
        <HudButton
          kind="primary"
          icon={withdrawing ? "exit" : "transfer"}
          disabled={amount <= 0 || amount > transfer.most}
          onClick={confirm}
        >
          {confirmLabel}
        </HudButton>
      </div>
      {!withdrawing && amount > 0 && amount === orders.armyTroops && (
        <HudNotice tone="warn" line={DEEP_WORDS.guardAll} />
      )}
    </div>
  );
};

const guardWord = (troops: Pick<Troops, "category">, guard: DeepGuard, phone: boolean) => {
  if (guard.kind === "taken" && guard.slots.length === 0) return DEEP_WORDS.addGuard;
  return phone ? DEEP_WORDS.guardShort : DEEP_WORDS.guardWith(frontierTroopName(troops.category));
};

const frontName = (site: DeepSiteProps["site"], guard: DeepGuard) =>
  guard.kind === "beast"
    ? DEEP_BEASTS[site].name
    : guard.kind === "taken"
      ? inFightOrder(guard.slots)[0]?.owner
      : undefined;

const OrderFoot = ({
  order,
  guard,
  site,
  onPick,
}: {
  order: DeepOrder | DeepBlock;
  guard: DeepGuard;
  site: DeepSiteProps["site"];
  onPick: (want: Picking["kind"]) => void;
}) => {
  const phone = useHudLayout() !== "desktop";
  if (typeof order === "string")
    return <HudWindowFoot note={order === "slotsFull" ? DEEP_WORDS.slotsFull(SLOTS) : DEEP_WORDS[order]} />;
  if (order.kind === "closed") return null;
  const footPrices = order.kind === "move" ? order.prices : undefined;
  const front = frontName(site, guard);
  const attackWord =
    order.kind === "attack" && order.verb === "take"
      ? DEEP_WORDS.take
      : front && !phone
        ? DEEP_WORDS.attackOf(front)
        : DEEP_WORDS.attack;
  return (
    <HudWindowFoot note={footPrices ? <HudPrice prices={footPrices} /> : undefined}>
      {order.kind === "guard" && (
        <span data-deep-foot className="deep-foot__btns">
          {order.guard && (
            <HudButton kind="primary" icon="transfer" busy={order.busy} onClick={() => onPick("guard")}>
              {guardWord(order.troops, guard, phone)}
            </HudButton>
          )}
          {order.withdraw && (
            <HudButton kind="secondary" icon="exit" onClick={() => onPick("withdraw")}>
              {DEEP_WORDS.withdraw}
            </HudButton>
          )}
        </span>
      )}
      {order.kind === "attack" && (
        <span data-deep-foot className="deep-foot__btns">
          <HudButton
            kind="primary"
            icon="attack"
            aria-label={order.busy ? undefined : attackWord}
            busy={order.busy}
            onClick={order.onAct}
          >
            {attackWord}
            {order.stamina !== undefined && order.stamina > 0 && <AttackStamina stamina={order.stamina} />}
          </HudButton>
        </span>
      )}
      {order.kind === "short" && (
        <span data-deep-foot className="deep-foot__btns">
          <HudButton kind="primary" icon="attack" disabled>
            {attackWord}
          </HudButton>
        </span>
      )}
      {order.kind === "move" && (
        <HudButton kind="primary" icon="move" onClick={order.onMove}>
          {MOVE}
        </HudButton>
      )}
    </HudWindowFoot>
  );
};
