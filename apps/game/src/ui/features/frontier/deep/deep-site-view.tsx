import "./deep-site.css";

import { heldOaths } from "@bibliothecadao/eternum";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { oathEffectDescription, oathName } from "../army/oath-details";
import type { PickEffectBase } from "../pick-effect-format";
import { Icon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type Price } from "@/ui/design-system/kit/price-faces";
import {
  HudButton,
  HudChip,
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
} from "@bibliothecadao/types";
import { beastMeaning, troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { nativeRuleConstants } from "../../../../../../../contracts/l3/world-native/schema/balance.gen";

import { AttackStamina, FightArena } from "../sites/fight-side";
import { CombatMark } from "../sites/combat-mark";
import type { DeepSiteFight } from "../sites/site-card-plan";

import { DEEP_SITE_FACES } from "./deep-site-faces";

export interface DeepTickPay {
  glory: number;
  height: number;
  essence: number;
  labor: number;
  bar: { perTick: number; charge: number; threshold: number } | null;
}

export interface DeepSlot {
  slot: number;
  armyId: number;
  oaths: number;
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
      ally: boolean;
      slots: readonly DeepSlot[];
      next: number;
    }
  | { kind: "open" };

export type DeepBlock = "pickArmy" | "guarding" | "full" | "rival" | "otherDay" | "noTroops";

export type DeepOrder =
  | { kind: "act"; verb: "attack" | "take" | "join"; stamina?: number; busy?: string; onAct: () => void }
  | { kind: "short"; verb: "attack"; line: string }
  | { kind: "move"; prices: readonly Price[]; onMove: () => void }
  | { kind: "closed"; realms: number };

export interface DeepSiteProps {
  site: (typeof deepSites)[number]["key"];
  pay: DeepTickPay | null;
  guard: DeepGuard;
  fight?: DeepSiteFight;
  attackerName?: string;
  pickBase: PickEffectBase;
  order: DeepOrder | DeepBlock;
  onClose: () => void;
}

const FIGHT_ORDER = Array.from(
  { length: nativeRuleConstants.DEEP_GUARD_SLOTS },
  (_, index) => nativeRuleConstants.DEEP_GUARD_SLOTS - 1 - index,
);

const siteName = (key: DeepSiteProps["site"]) => deepSites.find((each) => each.key === key)!.name;

export const DeepSiteView = ({ site, pay, guard, fight, attackerName, pickBase, order, onClose }: DeepSiteProps) => {
  const face = DEEP_SITE_FACES[site];
  return (
    <HudSheet label={siteName(site)} onClose={onClose}>
      <div className="deep-head">
        <span className="deep-head__mark">
          <Icon name={face.icon} size={40} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {guard.kind === "held" ? (
            <div
              className="deep-holder"
              data-aspect-holder={guard.aspectId}
              data-aspect-id={guard.aspectId}
              data-side={guard.ally ? "ally" : "rival"}
            >
              <span className="text-hud-muted">{DEEP_WORDS.heldByPrefix}</span>
              <AspectMark aspect={guard.aspectId} size={18} decorative />
              <span className={cn("text-hud-strong", guard.ally ? "text-hud-ally" : "text-hud-bad")}>
                {aspectName(guard.aspectId)}
              </span>
              <span className="text-hud-muted">·</span>
              <span className="text-hud-label text-hud-muted">
                {DEEP_WORDS.guardsCount(guard.slots.length, nativeRuleConstants.DEEP_GUARD_SLOTS)}
              </span>
            </div>
          ) : (
            <span className="text-hud-strong text-hud-ink">{face.purpose}</span>
          )}
        </div>
      </div>
      {fight && <FightPreview site={site} fight={fight} guard={guard} attackerName={attackerName} />}
      <GuardStrip site={site} guard={guard} pickBase={pickBase} />
      {pay && <TickPay pay={pay} />}
      <OrderFoot order={order} />
      {typeof order === "object" && order.kind === "short" && <HudNotice tone="warn" line={order.line} />}
    </HudSheet>
  );
};

const FightPreview = ({
  site,
  fight,
  guard,
  attackerName,
}: {
  site: DeepSiteProps["site"];
  fight: DeepSiteFight;
  guard: DeepGuard;
  attackerName?: string;
}) => {
  const result = fight.result && !("refused" in fight.result) ? fight.result : undefined;
  const attackerLabel = attackerName ?? ARMY;
  const frontGuard = guard.kind === "held" ? guard.slots.find((each) => each.armyId === guard.next) : undefined;
  const defenderLabel = guard.kind === "beast" ? DEEP_BEASTS[site].name : (frontGuard?.realm ?? TROOPS);
  const defenderArt =
    guard.kind === "beast" ? beastMeaning(beastModel(DEEP_BEASTS[site])) : troopMeaning(fight.defenderTroops);
  return (
    <FightArena
      ours={{
        label: attackerLabel,
        mark: <Icon name={troopMeaning(fight.attackerTroops)} size={96} className="size-full" />,
        before: fight.army,
        kept: result && fight.army - result.troopsLost,
      }}
      theirs={{
        label: defenderLabel,
        mark: <Icon name={defenderArt} size={96} className="size-full" />,
        before: fight.defender,
        kept: result?.guardLeft,
      }}
    />
  );
};

const TickPay = ({ pay }: { pay: DeepTickPay }) => (
  <span
    data-deep-pay
    data-tip={`${DEEP_WORDS.tickPays} (${DEEP_WORDS.splitByTroops})`}
    className="flex flex-wrap items-center gap-1.5 text-hud-label text-hud-muted"
  >
    {pay.glory > 0 && <HudChip icons={["crown"]}>{DEEP_WORDS.glory(pay.glory)}</HudChip>}
    {pay.height > 0 && <HudChip icons={["hyperstructure"]}>{DEEP_WORDS.height(pay.height)}</HudChip>}
    {pay.essence > 0 && <HudChip icons={["essence"]}>{DEEP_WORDS.essence(pay.essence)}</HudChip>}
    {pay.labor > 0 && <HudChip icons={["labor"]}>{DEEP_WORDS.labor(pay.labor)}</HudChip>}
    {pay.bar && (
      <HudChip icons={["flame"]}>{DEEP_WORDS.bar(pay.bar.perTick, pay.bar.charge, pay.bar.threshold)}</HudChip>
    )}
  </span>
);

const slotTip = (slot: DeepSlot, next: boolean, pickBase: PickEffectBase): string => {
  const oaths = heldOaths(slot.oaths).map((id) => `${oathName(id)} (${oathEffectDescription(id, pickBase)})`);
  return [
    next ? `${slot.realm} · ${DEEP_WORDS.facesNext}` : slot.realm,
    formatExact(slot.troops),
    DEEP_WORDS.drainTick(slot.lossPerTick),
    DEEP_WORDS.lasts(slot.ticks.left, slot.ticks.time),
    DEEP_WORDS.share(slot.share),
    ...oaths,
  ].join(" · ");
};

const guardDrainLabel = (slots: readonly DeepSlot[]): string | null => {
  if (slots.length === 0) return null;
  const losses = slots.map((slot) => slot.lossPerTick);
  const min = Math.min(...losses);
  const max = Math.max(...losses);
  return min === max ? DEEP_WORDS.drainTick(min) : DEEP_WORDS.drainRange(min, max);
};

const GuardStrip = ({
  site,
  guard,
  pickBase,
}: {
  site: DeepSiteProps["site"];
  guard: DeepGuard;
  pickBase: PickEffectBase;
}) => {
  if (guard.kind === "beast")
    return (
      <HudRow
        lead={<Icon name={beastMeaning(beastModel(DEEP_BEASTS[site]))} size={36} />}
        title={DEEP_WORDS.beast(DEEP_BEASTS[site].name, guard.troops)}
        trail={<CombatMark category={guard.category} />}
        state="beast"
      />
    );
  if (guard.kind === "open") return <HudRow lead={<Icon name="flag" size={32} />} title={DEEP_WORDS.open} />;
  const filled = FIGHT_ORDER.flatMap((slot) => {
    const held = guard.slots.find((each) => each.slot === slot);
    return held ? [held] : [];
  });
  const free = FIGHT_ORDER.filter((slot) => !guard.slots.some((each) => each.slot === slot));
  const frontGuard = filled.find((each) => each.armyId === guard.next) ?? filled[0];
  return (
    <div data-deep-slots className="flex flex-col gap-2">
      <div className="deep-guards">
        <div className="deep-guards__row">
          {filled.map((held) => {
            const isNext = held.armyId === guard.next;
            const tip = slotTip(held, isNext, pickBase);
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
        {guardDrainLabel(guard.slots) && (
          <span data-deep-drain className="deep-drain">
            <Icon name="attack" size={16} />
            <span className="tabular-nums text-hud-bad">{guardDrainLabel(guard.slots)}</span>
          </span>
        )}
      </div>
      {frontGuard && (
        <div data-guard-oaths={frontGuard.oaths} className="flex flex-wrap items-center gap-1.5 empty:hidden">
          {heldOaths(frontGuard.oaths).map((id) => (
            <span
              key={id}
              data-oath={id}
              title={oathEffectDescription(id, pickBase)}
              className="inline-flex items-center gap-1 text-hud-label text-hud-muted"
            >
              <Icon name={orderMeaning(id)} size={16} />
              {oathName(id)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const OrderFoot = ({ order }: { order: DeepOrder | DeepBlock }) => {
  if (typeof order === "string") return <HudWindowFoot note={DEEP_WORDS[order]} />;
  if (order.kind === "closed") return <HudWindowFoot note={DEEP_WORDS.opensAt(order.realms)} />;
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
