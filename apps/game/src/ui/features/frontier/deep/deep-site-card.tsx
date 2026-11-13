import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudCost, HudRow, HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { costLine } from "@/ui/design-system/kit/price-faces";
import { ATTACKING, DEEP_WORDS, MOVE, USING } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { configManager } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { aspectName, formatDuration, formatExact } from "@bibliothecadao/types";

import { useOrderAt } from "../hud/army-order";
import { useApproachTile } from "../sites/approach";
import { useSelectedOwnArmy } from "../sites/selected-army";
import { inFlightWord } from "../sites/site-card-view";
import { DEEP_SITE_FACES } from "./deep-site-faces";
import {
  type DeepGuardState,
  type DeepSiteCardPlan,
  type DeepSlot,
  type DeepStep,
  type DeepTickPay,
  readDeepSiteCard,
  siteOf,
} from "./deep-site-plan";

/** What the card reads: the sites, their beasts and guards, the guards' armies and homes, the rules a tick pays by. */
const DEEP_SITE_MODELS = [
  "DeepSite",
  "DeepGuard",
  "DeepArmy",
  "DeepRules",
  "RaceRules",
  "AltarBar",
  "Guard",
  "ExplorerTroops",
  "ArmyDay",
  "HomeAspect",
  "Structure",
  "TileOccupancy",
] as const;

/** The four slots in the order an attacker fights them: the highest first, as a structure's guards are fought. */
const FIGHT_ORDER = [3, 2, 1, 0] as const;

/** A Deep site's card, read from the facts, with the selected army's order: Attack, Take, Join, or Move beside it. */
export const DeepSiteCard = ({ tile, onClose }: { tile: TileSpatialRenderable; onClose: () => void }) => {
  const { setup, account } = useGame();
  const viewer = useAccountAddress();
  const now = useCurrentBlockTimestamp();
  const actor = useSelectedOwnArmy();
  useNativeRevision(DEEP_SITE_MODELS);
  const siteTile = tile.hexCoords;
  const plan = readDeepSiteCard(
    setup.store,
    configManager.getActiveGameId(),
    siteTile,
    actor && { army: actor.army, tile: actor.armyTile },
    viewer,
    now,
  );
  const wantsApproach = plan?.kind === "site" && isOrder(plan.step) && !plan.inReach;
  const approach = useOrderAt(useApproachTile(siteTile, wantsApproach));
  const armyId = actor ? safeInteger(actor.army.explorer_id) : null;
  const inFlight = useInFlight("army", armyId)?.order;
  if (!plan) return null;
  if (plan.kind === "reading")
    return (
      <HudSheet label={DEEP_WORDS.reading} onClose={onClose}>
        <span className="text-hud-label text-hud-muted">{DEEP_WORDS.reading}</span>
      </HudSheet>
    );

  const send = async () => {
    if (armyId === null || !account.account || !isOrder(plan.step)) return;
    const signer = account.account;
    const attack = plan.step.kind === "attack";
    try {
      await sendOnce("army", armyId, { order: attack ? "attack" : "use" }, () => {
        playUnitCommandSound(attack ? "attack" : "move");
        return attack
          ? setup.systemCalls.attack_explorer_vs_guard({
              signer,
              explorer_id: armyId,
              structure_id: safeInteger(plan.site.id),
              relic_slot: undefined,
            })
          : setup.systemCalls.interact_site({
              signer,
              explorer_id: armyId,
              coord: { alt: siteTile.alt, x: siteTile.col, y: siteTile.row },
            });
      });
    } catch (error) {
      toast.failed(error, verbOf(plan.step));
    }
  };

  return (
    <DeepSiteCardView
      plan={plan}
      order={
        !isOrder(plan.step)
          ? null
          : plan.inReach
            ? {
                kind: "act",
                verb: verbOf(plan.step),
                busy: inFlightWord(
                  inFlight,
                  plan.step.kind === "attack" ? "attack" : "use",
                  plan.step.kind === "attack" ? ATTACKING : USING,
                ),
                onAct: () => void send(),
              }
            : approach
              ? {
                  kind: "move",
                  cost: costLine([
                    { of: "stamina", amount: approach.stamina.cost },
                    { of: "wheat", amount: approach.wheat.cost },
                  ]),
                  onMove: () => requestOrderAt(approach.target),
                }
              : null
      }
      onClose={onClose}
    />
  );
};

/** The card's order: the site's own verb beside it, or the Move that brings the army there. */
type DeepOrder =
  | { kind: "act"; verb: string; busy: string | undefined; onAct: () => void }
  | { kind: "move"; cost: string; onMove: () => void };

/**
 * A Deep site's card: who it serves and what a tick held pays, who guards it (its beast, or its four slots with each
 * army's troops, how long they last and its share), then the selected army's order or why it has none.
 */
const DeepSiteCardView = ({
  plan,
  order,
  onClose,
}: {
  plan: Extract<DeepSiteCardPlan, { kind: "site" }>;
  order: DeepOrder | null;
  onClose: () => void;
}) => {
  const face = DEEP_SITE_FACES[siteOf(plan.site).position];
  return (
    <HudSheet label={plan.site.name} onClose={onClose}>
      <div className="flex items-center gap-2">
        <SemanticIcon name={face.icon} size={48} />
        <div className="flex min-w-0 flex-col">
          <span className="text-hud-strong text-hud-ink">{face.purpose}</span>
          <TickPay pay={plan.pay} />
        </div>
      </div>
      <GuardRows guard={plan.guard} />
      <HudWindowFoot note={stepNote(plan.step, order)}>
        {order?.kind === "act" && (
          <HudButton kind="primary" busy={order.busy} onClick={order.onAct}>
            {order.verb}
          </HudButton>
        )}
        {order?.kind === "move" && (
          <HudButton kind="primary" icon="move" onClick={order.onMove}>
            {MOVE}
          </HudButton>
        )}
      </HudWindowFoot>
    </HudSheet>
  );
};

/** What a tick held pays, as chips with their paintings, and that it is split by troops. */
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

/** The site's guard: today's beast, nobody, or the holder's four slots in the order they are fought, each filled or free. */
const GuardRows = ({ guard }: { guard: DeepGuardState }) => {
  if (guard.kind === "beast")
    return (
      <HudRow lead={<SemanticIcon name="beasts" size={32} />} title={DEEP_WORDS.beast(guard.troops)} state="beast" />
    );
  if (guard.kind === "open") return <HudRow lead={<SemanticIcon name="flag" size={32} />} title={DEEP_WORDS.open} />;
  return (
    <div data-deep-slots className="flex flex-col gap-1">
      <span className="text-hud-strong text-hud-ink">{DEEP_WORDS.heldBy(aspectName(guard.aspect))}</span>
      <span className="text-hud-label text-hud-muted">{DEEP_WORDS.foughtInOrder}</span>
      {FIGHT_ORDER.map((slot) => {
        const held = guard.slots.find((each) => each.slot === slot);
        return held ? (
          <SlotRow key={slot} slot={held} next={held.armyId === guard.next} />
        ) : (
          <HudRow key={slot} lead={<SemanticIcon name="plus" size={32} />} title={DEEP_WORDS.freeSlot} />
        );
      })}
    </div>
  );
};

/**
 * A filled slot: its player's realm, its troops, how long they last (ticks, and the time that is) and its share of each
 * tick. A hold lasts as long as its troops; the facts hold no count of what the army came with, so no bar of it.
 */
const SlotRow = ({ slot, next }: { slot: DeepSlot; next: boolean }) => (
  <HudRow
    lead={<SemanticIcon name="troops" size={32} />}
    title={next ? `${slot.realm} · ${DEEP_WORDS.facesNext}` : slot.realm}
    selected={slot.mine}
    detail={`${DEEP_WORDS.lasts(slot.ticks.left, formatDuration(slot.ticks.seconds, { days: false }))} · ${DEEP_WORDS.share(slot.share)}`}
    trail={formatExact(slot.troops)}
  />
);

/** Why the selected army has no order here, or the Move's cost while it is away; nothing beside its own verb. */
const stepNote = (step: DeepStep | null, order: DeepOrder | null) => {
  if (order?.kind === "move") return <HudCost line={order.cost} />;
  if (order?.kind === "act") return undefined;
  if (step === null) return DEEP_WORDS.pickArmy;
  const reasons: Record<Exclude<DeepStep["kind"], "attack" | "take" | "join">, string> = {
    guarding: DEEP_WORDS.guarding,
    full: DEEP_WORDS.full,
    rival: DEEP_WORDS.rival,
    "other-day": DEEP_WORDS.otherDay,
  };
  return isOrder(step) ? undefined : reasons[step.kind];
};

/** A step the contract takes as an order from beside the site. */
const isOrder = (step: DeepStep | null): step is Extract<DeepStep, { kind: "attack" | "take" | "join" }> =>
  step !== null && (step.kind === "attack" || step.kind === "take" || step.kind === "join");

const verbOf = (step: Extract<DeepStep, { kind: "attack" | "take" | "join" }>): string =>
  ({ attack: DEEP_WORDS.attack, take: DEEP_WORDS.take, join: DEEP_WORDS.join })[step.kind];
