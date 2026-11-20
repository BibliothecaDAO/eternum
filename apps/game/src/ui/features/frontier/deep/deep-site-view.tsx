import { heldOaths } from "@bibliothecadao/eternum";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { oathEffectDescription, oathName } from "../army/oath-details";
import { Icon } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudCost,
  HudNotice,
  HudRow,
  HudSheet,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { ARMY, DEEP_WORDS, MOVE, TROOPS } from "@/ui/design-system/kit/words";
import { DEEP_BEASTS, type Troops, beastModel, deepSites, formatExact } from "@bibliothecadao/types";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { nativeRuleConstants } from "../../../../../../../contracts/l3/world-native/schema/balance.gen";

import { FightSide } from "../sites/fight-side";
import { CombatMark } from "../sites/combat-mark";
import type { DeepSiteFight } from "../sites/site-card-plan";

import { DEEP_SITE_FACES } from "./deep-site-faces";

/** What one tick held pays a site's guards, split among them by troops; a figure of 0 is not shown. */
export interface DeepTickPay {
  glory: number;
  /** Height added to the holder Aspect's hyperstructure: the Foundation's. */
  height: number;
  essence: number;
  labor: number;
  /** Charge added to the holder Aspect's bane bar, its charge now and the charge that issues a bane: the Altar's. */
  bar: { perTick: number; charge: number; threshold: number } | null;
}

/** One filled slot of a held site: the player's realm, its troops, how long they last and its share of each tick. */
export interface DeepSlot {
  slot: number;
  armyId: number;
  oaths: number;
  category: Troops["category"];
  realm: string;
  troops: number;
  ticks: { left: number; time: string };
  /** Out of 100: its troops over the guard's. */
  share: number;
  mine: boolean;
}

/** Who stands on the site today: its beast, its holder's slots (any order), or nobody. */
export type DeepGuard =
  | { kind: "beast"; troops: number; category: Troops["category"] }
  | { kind: "held"; aspect: string; slots: readonly DeepSlot[]; next: number }
  | { kind: "open" };

/** Why the selected army has no order at the site, in the words the card shows. */
export type DeepBlock = "pickArmy" | "guarding" | "full" | "rival" | "otherDay" | "noTroops";

/** The card's order: the site's own verb beside it, the same verb held for stamina, or the Move that brings the army. */
export type DeepOrder =
  | { kind: "act"; verb: "attack" | "take" | "join"; busy?: string; onAct: () => void }
  | { kind: "short"; verb: "attack"; line: string }
  | { kind: "move"; cost: string; onMove: () => void }
  | { kind: "closed"; realms: number };

export interface DeepSiteProps {
  site: (typeof deepSites)[number]["key"];
  pay: DeepTickPay | null;
  guard: DeepGuard;
  fight?: DeepSiteFight;
  /** The order the selected army has, or why it has none. */
  order: DeepOrder | DeepBlock;
  onClose: () => void;
}

/** The slots in the order an attacker fights them: the highest first, as a structure's guards are fought. */
const FIGHT_ORDER = Array.from(
  { length: nativeRuleConstants.DEEP_GUARD_SLOTS },
  (_, index) => nativeRuleConstants.DEEP_GUARD_SLOTS - 1 - index,
);

const siteName = (key: DeepSiteProps["site"]) => deepSites.find((each) => each.key === key)!.name;

/**
 * A Deep site's card: who it serves and what a tick held pays, who guards it (its beast, or its four slots with each
 * army's troops, how long they last and its share), then the selected army's order or why it has none.
 */
export const DeepSiteView = ({ site, pay, guard, fight, order, onClose }: DeepSiteProps) => {
  const face = DEEP_SITE_FACES[site];
  return (
    <HudSheet label={siteName(site)} onClose={onClose}>
      <div className="flex items-center gap-2">
        <Icon name={face.icon} size={48} />
        <div className="flex min-w-0 flex-col">
          <span className="text-hud-strong text-hud-ink">{face.purpose}</span>
          {pay && <TickPay pay={pay} />}
        </div>
      </div>
      {fight && <FightPreview fight={fight} />}
      <GuardRows site={site} guard={guard} />
      <OrderFoot order={order} />
      {typeof order === "object" && order.kind === "short" && <HudNotice tone="warn" line={order.line} />}
    </HudSheet>
  );
};

const FightPreview = ({ fight }: { fight: DeepSiteFight }) => {
  const result = fight.result && !("refused" in fight.result) ? fight.result : undefined;
  return (
    <div className="flex gap-2">
      <FightSide
        label={ARMY}
        mark={null}
        before={fight.army}
        kept={result && fight.army - result.troopsLost}
        side="ours"
      />
      <FightSide label={TROOPS} mark={null} before={fight.defender} kept={result?.guardLeft} side="theirs" />
    </div>
  );
};

const TickPay = ({ pay }: { pay: DeepTickPay }) => (
  <span data-deep-pay className="flex flex-wrap items-center gap-1 text-hud-label text-hud-muted">
    <span>
      {DEEP_WORDS.tickPays} ({DEEP_WORDS.splitByTroops}):
    </span>
    {pay.glory > 0 && <HudChip icons={["crown"]}>{DEEP_WORDS.glory(pay.glory)}</HudChip>}
    {pay.height > 0 && <HudChip icons={["hyperstructure"]}>{DEEP_WORDS.height(pay.height)}</HudChip>}
    {pay.essence > 0 && <HudChip icons={["essence"]}>{DEEP_WORDS.essence(pay.essence)}</HudChip>}
    {pay.labor > 0 && <HudChip icons={["labor"]}>{DEEP_WORDS.labor(pay.labor)}</HudChip>}
    {pay.bar && (
      <HudChip icons={["flame"]}>{DEEP_WORDS.bar(pay.bar.perTick, pay.bar.charge, pay.bar.threshold)}</HudChip>
    )}
  </span>
);

const GuardRows = ({ site, guard }: { site: DeepSiteProps["site"]; guard: DeepGuard }) => {
  if (guard.kind === "beast")
    return (
      <HudRow
        lead={<Icon name={beastMeaning(beastModel(DEEP_BEASTS[site]))} size={32} />}
        title={DEEP_WORDS.beast(DEEP_BEASTS[site].name, guard.troops)}
        trail={<CombatMark category={guard.category} />}
        state="beast"
      />
    );
  if (guard.kind === "open") return <HudRow lead={<Icon name="flag" size={32} />} title={DEEP_WORDS.open} />;
  return (
    <div data-deep-slots className="flex flex-col gap-1">
      <span className="text-hud-strong text-hud-ink">{DEEP_WORDS.heldBy(guard.aspect)}</span>
      <span className="text-hud-label text-hud-muted">{DEEP_WORDS.foughtInOrder}</span>
      {FIGHT_ORDER.map((slot) => {
        const held = guard.slots.find((each) => each.slot === slot);
        return held ? (
          <SlotRow key={slot} slot={held} next={held.armyId === guard.next} />
        ) : (
          <HudRow key={slot} lead={<Icon name="plus" size={32} />} title={DEEP_WORDS.freeSlot} />
        );
      })}
    </div>
  );
};

const SlotRow = ({ slot, next }: { slot: DeepSlot; next: boolean }) => (
  <HudRow
    lead={<CombatMark category={slot.category} />}
    title={next ? `${slot.realm} · ${DEEP_WORDS.facesNext}` : slot.realm}
    selected={slot.mine}
    detail={
      <>
        <span>{`${DEEP_WORDS.lasts(slot.ticks.left, slot.ticks.time)} · ${DEEP_WORDS.share(slot.share)}`}</span>
        <span data-guard-oaths={slot.oaths} className="flex flex-wrap gap-2">
          {heldOaths(slot.oaths).map((id) => (
            <span key={id} data-oath={id} title={oathEffectDescription(id)} className="inline-flex items-center gap-1">
              <Icon name={orderMeaning(id)} size={20} />
              {oathName(id)}
            </span>
          ))}
        </span>
      </>
    }
    trail={formatExact(slot.troops)}
  />
);

const OrderFoot = ({ order }: { order: DeepOrder | DeepBlock }) => {
  if (typeof order === "string") return <HudWindowFoot note={DEEP_WORDS[order]} />;
  if (order.kind === "closed") return <HudWindowFoot note={DEEP_WORDS.opensAt(order.realms)} />;
  return (
    <HudWindowFoot note={order.kind === "move" ? <HudCost line={order.cost} /> : undefined}>
      {order.kind === "act" && (
        <HudButton kind="primary" busy={order.busy} onClick={order.onAct}>
          {DEEP_WORDS[order.verb]}
        </HudButton>
      )}
      {order.kind === "short" && (
        <HudButton kind="primary" disabled>
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
