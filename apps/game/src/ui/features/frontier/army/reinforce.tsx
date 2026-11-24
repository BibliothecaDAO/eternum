import "./reinforce.css";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Icon } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudNotice,
  HudPortrait,
  HudPrice,
  HudSheet,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { shortfallLine } from "@/ui/design-system/kit/reasons";
import {
  DEPLOY_WORDS,
  NO_TROOPS_AT_HOME,
  REINFORCE,
  SUPPLY_POST,
  TRANSFER_TROOPS,
  TROOPS,
  wheatForOnly,
} from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { multiplyByPrecision } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatExact, formatShort } from "@bibliothecadao/types";
import { useState } from "react";

import { type March, marchOn, wheatStopsAt } from "../deploy/deploy-plan";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { TARGET_MARKS } from "../sites/site-marks";
import { SizeRow } from "../size-row";
import { reinforcementSource, readReinforcePlan, type ReinforcePlan, reinforceRange } from "./reinforce-plan";

const REINFORCE_MODELS = [
  "ExplorerTroops",
  "TileOccupancy",
  "Structure",
  "ResourceBalance",
  "ResourceProduction",
  "RealmKnowledge",
  "ExpeditionSite",
] as const;

/**
 * The reinforcement the map has selected: the player's realm acting on the tile of one of its armies standing beside
 * it, as Blitz reinforces (the realm selected, the army right-clicked or, on a phone, held). Null for anything else, an
 * army that has left the realm's side, and a viewer, who orders no army.
 */
export const useSelectedReinforcement = (realm: NativeRows["Structure"] | null): DockArmy | null => {
  const { setup } = useGame();
  const armies = useDockArmies(realm);
  const timestamp = useCurrentDefaultTick();
  const selection = useUIStore((state) => state.mapSelection);
  const ordersAllowed = useUIStore(canIssueOrders);
  if (!realm || !ordersAllowed || selection?.kind !== "structure" || !selection.tile) return null;
  if (Number(selection.entityId) !== Number(realm.entity_id)) return null;
  const tile = selection.tile;
  const standsThere = (army: DockArmy) => {
    const at = setup.store.entityOccupancy(realm.game_id, army.explorerId);
    return at !== undefined && !at.alt && at.col === tile.col && at.row === tile.row;
  };
  return (
    armies.find(
      (army) => standsThere(army) && reinforcementSource(setup.store, realm, army.explorerId, timestamp) !== null,
    ) ?? null
  );
};

/**
 * Troops from the realm's stock into its army beside it (owner, 4 November 2026: "can we just do it like in blitz ?
 * right click from the realm to the army opens the reinforcement"). The range it reads: the most troops the stock, the
 * army's room and the wheat allow. The contract adds troops of the army's own kind, so the stock is that kind's alone.
 */
export const useReinforceRange = (realm: NativeRows["Structure"], army: DockArmy) => {
  const { setup } = useGame();
  const defaultTick = useCurrentDefaultTick();
  useNativeRevision(REINFORCE_MODELS);
  const plan = readReinforcePlan(setup.store, realm, army.explorerId, defaultTick);
  const march = plan && army.stamina && marchOn(army.stamina, plan.current);
  const range = plan && march ? reinforceRange(plan, march) : { troopsMax: 0, wheatMax: 0, max: 0 };
  return { plan, march, range };
};

/**
 * Troops from home into one army, in one sheet (Opus's supply post with Neon's slider): the army's troops before → after
 * and the troops it gains, the size row at Max, and Reinforce naming the gain with its wheat beside it. At a supply post
 * the head names the camp and the sheet says how long the post stays open.
 */
export const ReinforceSheet = ({
  realm,
  army,
  post,
  onClose,
}: {
  realm: NativeRows["Structure"];
  army: DockArmy;
  post?: { id: number; name: string };
  onClose: () => void;
}) => {
  const { setup, account } = useGame();
  const defaultTick = useCurrentDefaultTick();
  const { plan, march, range } = useReinforceRange(realm, army);
  const [count, setCount] = useState<number | "max">("max");
  const shown = count === "max" ? range.max : Math.min(count, range.wheatMax);
  const wheatStop = wheatStopsAt(range, shown);
  const sending = useInFlight("army", army.explorerId) !== undefined;

  /**
   * The sheet stays until the order settles, its button carrying the wait; a refusal says why. The HUD then hands the
   * panel to the army while this pick still stands (useOrderSettledReturnsToTheArmy), and leaves a newer pick alone.
   */
  const reinforce = async () => {
    const signer = account.account;
    // Where the army stands is read again as it is sent: one that has moved off the realm's side sends nothing.
    const source = reinforcementSource(setup.store, realm, army.explorerId, defaultTick, post?.id);
    if (!signer || source === null || shown <= 0) return;
    try {
      await sendOnce("army", army.explorerId, { order: "use" }, () =>
        setup.systemCalls.explorer_add({
          signer,
          to_explorer_id: army.explorerId,
          amount: multiplyByPrecision(shown),
          supply_post: source.supplyPost,
        }),
      );
    } catch (error) {
      toast.failed(error, REINFORCE.failed);
    }
  };

  return (
    <HudSheet
      label={post ? SUPPLY_POST.title : REINFORCE.title(army.label)}
      cue={post && <HudChip icons={[TARGET_MARKS.Camp.icon]}>{post.name}</HudChip>}
      onClose={onClose}
    >
      {plan && <ArmyGain army={army} before={plan.current} gain={shown} />}
      <div className="reinforce-size">
        <SizeRow
          label={DEPLOY_WORDS.howMany(TROOPS)}
          value={shown}
          max={range.max}
          most={range.wheatMax}
          disabled={range.wheatMax === 0 || sending}
          onChange={(next) => setCount(range.max > 0 && next === range.max ? "max" : next)}
        />
      </div>
      {plan && march && <ReinforceLimit plan={plan} march={march} wheatStop={wheatStop} />}
      {post && (
        <p className="reinforce-until">
          <Icon name="hourglass" size={16} />
          {SUPPLY_POST.until}
        </p>
      )}
      {plan && range.wheatMax > 0 && (
        <HudWindowFoot note={<HudPrice prices={[{ of: "wheat", amount: plan.raise.wheatFor(shown) }]} />}>
          <HudButton
            kind="primary"
            icon="military"
            disabled={shown === 0}
            busy={sending ? REINFORCE.sending : undefined}
            onClick={reinforce}
          >
            {REINFORCE.verbAmount(formatExact(shown))}
          </HudButton>
        </HudWindowFoot>
      )}
    </HudSheet>
  );
};

/** The army the troops go to: its painting, its name, its troops before → after, and the gain as a chip. */
const ArmyGain = ({ army, before, gain }: { army: DockArmy; before: number; gain: number }) => (
  <div data-supply-army className="reinforce-army">
    <HudPortrait icon={army.art} label={TROOPS} />
    <span className="reinforce-army__words">
      <b>{army.label}</b>
      <span className="reinforce-army__troops">
        {formatExact(before)} <span className="reinforce-army__arrow">→</span>{" "}
        <span className="reinforce-army__after">{formatExact(before + gain)}</span>
      </span>
    </span>
    <HudChip icons={[army.art]} label={TROOPS} tone="good">
      {formatShort(gain, { signed: true })}
    </HudChip>
  </div>
);

/** Why the count stops where it does: no such troops at home, the army at its cap, or the wheat at the most. */
const ReinforceLimit = ({
  plan,
  march,
  wheatStop,
}: {
  plan: ReinforcePlan;
  march: March;
  wheatStop: ReturnType<typeof wheatStopsAt>;
}) => {
  if (plan.current >= plan.cap) return <HudNotice tone="warn" line={TRANSFER_TROOPS.cap(plan.cap)} />;
  if (plan.stock === 0) return <HudNotice tone="warn" line={NO_TROOPS_AT_HOME} />;
  if (!wheatStop) return null;
  const line =
    wheatStop.troops === 0
      ? shortfallLine({
          kind: "short",
          of: "wheat",
          held: plan.raise.wheat,
          need: plan.raise.wheatToGo(1, march),
          wait: undefined,
        })
      : wheatForOnly(formatExact(wheatStop.troops), formatExact(wheatStop.of));
  return <HudNotice tone="bad" icon="wheat" line={line} />;
};
