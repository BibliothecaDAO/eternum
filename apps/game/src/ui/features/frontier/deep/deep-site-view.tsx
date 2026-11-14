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
import { DEEP_WORDS, MOVE } from "@/ui/design-system/kit/words";
import { deepSites, formatExact } from "@bibliothecadao/types";
import { nativeRuleConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";

import { DEEP_SITE_FACES } from "./deep-site-faces";

/** What one tick held pays a site's guards, split among them by troops; a figure of 0 is not shown. */
export interface DeepTickPay {
  glory: number;
  /** Height added to the holder Aspect's hyperstructure: the Foundation's. */
  height: number;
  /** Labor, and the same of Essence, to the guards' realms: the Quarry's. */
  resources: number;
  /** Charge added to the holder Aspect's bane bar, its charge now and the charge that issues a bane: the Altar's. */
  bar: { perTick: number; charge: number; threshold: number } | null;
}

/** One filled slot of a held site: the player's realm, its troops, how long they last and its share of each tick. */
export interface DeepSlot {
  slot: number;
  armyId: number;
  realm: string;
  troops: number;
  ticks: { left: number; time: string };
  /** Out of 100: its troops over the guard's. */
  share: number;
  mine: boolean;
}

/** Who stands on the site today: its beast, its holder's slots (any order), or nobody. */
export type DeepGuard =
  | { kind: "beast"; troops: number }
  | { kind: "held"; aspect: string; slots: readonly DeepSlot[]; next: number }
  | { kind: "open" };

/** Why the selected army has no order at the site, in the words the card shows. */
export type DeepBlock = "pickArmy" | "guarding" | "full" | "rival" | "otherDay" | "noTroops";

/** The card's order: the site's own verb beside it, the same verb held for stamina, or the Move that brings the army. */
export type DeepOrder =
  | { kind: "act"; verb: "attack" | "take" | "join"; busy?: string; onAct: () => void }
  | { kind: "short"; verb: "attack"; line: string }
  | { kind: "move"; cost: string; onMove: () => void };

export interface DeepSiteProps {
  site: (typeof deepSites)[number]["position"];
  pay: DeepTickPay;
  guard: DeepGuard;
  /** The order the selected army has, or why it has none. */
  order: DeepOrder | DeepBlock;
  onClose: () => void;
}

/** The slots in the order an attacker fights them: the highest first, as a structure's guards are fought. */
const FIGHT_ORDER = Array.from(
  { length: nativeRuleConstants.DEEP_GUARD_SLOTS },
  (_, index) => nativeRuleConstants.DEEP_GUARD_SLOTS - 1 - index,
);

const siteName = (position: DeepSiteProps["site"]) => deepSites.find((each) => each.position === position)!.name;

/**
 * A Deep site's card: who it serves and what a tick held pays, who guards it (its beast, or its four slots with each
 * army's troops, how long they last and its share), then the selected army's order or why it has none.
 */
export const DeepSiteView = ({ site, pay, guard, order, onClose }: DeepSiteProps) => {
  const face = DEEP_SITE_FACES[site];
  return (
    <HudSheet label={siteName(site)} onClose={onClose}>
      <div className="flex items-center gap-2">
        <Icon name={face.icon} size={48} />
        <div className="flex min-w-0 flex-col">
          <span className="text-hud-strong text-hud-ink">{face.purpose}</span>
          <TickPay pay={pay} />
        </div>
      </div>
      <GuardRows guard={guard} />
      <OrderFoot order={order} />
      {typeof order === "object" && order.kind === "short" && <HudNotice tone="warn" line={order.line} />}
    </HudSheet>
  );
};

const TickPay = ({ pay }: { pay: DeepTickPay }) => (
  <span data-deep-pay className="flex flex-wrap items-center gap-1 text-hud-label text-hud-muted">
    <span>
      {DEEP_WORDS.tickPays} ({DEEP_WORDS.splitByTroops}):
    </span>
    {pay.glory > 0 && <HudChip icons={["crown"]}>{DEEP_WORDS.glory(pay.glory)}</HudChip>}
    {pay.height > 0 && <HudChip icons={["hyperstructure"]}>{DEEP_WORDS.height(pay.height)}</HudChip>}
    {pay.resources > 0 && <HudChip icons={["labor", "essence"]}>{DEEP_WORDS.resources(pay.resources)}</HudChip>}
    {pay.bar && (
      <HudChip icons={["flame"]}>{DEEP_WORDS.bar(pay.bar.perTick, pay.bar.charge, pay.bar.threshold)}</HudChip>
    )}
  </span>
);

const GuardRows = ({ guard }: { guard: DeepGuard }) => {
  if (guard.kind === "beast")
    return <HudRow lead={<Icon name="beasts" size={32} />} title={DEEP_WORDS.beast(guard.troops)} state="beast" />;
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
    lead={<Icon name="troops" size={32} />}
    title={next ? `${slot.realm} · ${DEEP_WORDS.facesNext}` : slot.realm}
    selected={slot.mine}
    detail={`${DEEP_WORDS.lasts(slot.ticks.left, slot.ticks.time)} · ${DEEP_WORDS.share(slot.share)}`}
    trail={formatExact(slot.troops)}
  />
);

const OrderFoot = ({ order }: { order: DeepOrder | DeepBlock }) => {
  if (typeof order === "string") return <HudWindowFoot note={DEEP_WORDS[order]} />;
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
