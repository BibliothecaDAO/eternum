import "./reinforce.css";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  HudButton,
  HudChip,
  HudLine,
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
import {
  configManager,
  isSupplyPost,
  multiplyByPrecision,
  readExpeditionRules,
  siteDisplayName,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatExact, formatShort } from "@bibliothecadao/types";
import { useState } from "react";

import { type March, marchOn, wheatStopsAt } from "../deploy/deploy-plan";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { TARGET_MARKS } from "../sites/site-marks";
import { SizeRow } from "../size-row";
import { dayClock } from "../hud/day-clock";
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

export const useSelectedReinforcement = (
  realm: NativeRows["Structure"] | null,
): { army: DockArmy; post?: SupplyPostName } | null => {
  const { setup } = useGame();
  const armies = useDockArmies(realm);
  const timestamp = useCurrentDefaultTick();
  const selection = useUIStore((state) => state.mapSelection);
  const ordersAllowed = useUIStore(canIssueOrders);
  if (!realm || !ordersAllowed || selection?.kind !== "structure" || !selection.tile) return null;
  const post = Number(selection.entityId) === Number(realm.entity_id) ? undefined : Number(selection.entityId);
  if (post !== undefined && !ownSupplyPost(setup.store, realm, post, timestamp)) return null;
  const tile = selection.tile;
  const standsThere = (army: DockArmy) => {
    const at = setup.store.entityOccupancy(realm.game_id, army.explorerId);
    return at !== undefined && !at.alt && at.col === tile.col && at.row === tile.row;
  };
  const army = armies.find(
    (entry) => standsThere(entry) && reinforcementSource(setup.store, realm, entry.explorerId, timestamp, post) !== null,
  );
  if (!army) return null;
  return post === undefined ? { army } : { army, post: { id: post, name: siteDisplayName(post) } };
};

type SupplyPostName = { id: number; name: string };

const ownSupplyPost = (store: NativeFactStore, realm: NativeRows["Structure"], post: number, timestamp: number) => {
  const site = store.get("ExpeditionSite", { game_id: realm.game_id, entity_id: post });
  return site !== undefined && isSupplyPost(store, site, realm.entity_id, timestamp);
};

export const useReinforceRange = (realm: NativeRows["Structure"], army: DockArmy) => {
  const { setup } = useGame();
  const defaultTick = useCurrentDefaultTick();
  useNativeRevision(REINFORCE_MODELS);
  const plan = readReinforcePlan(setup.store, realm, army.explorerId, defaultTick);
  const march = plan && army.stamina && marchOn(army.stamina, plan.current);
  const range = plan && march ? reinforceRange(plan, march) : { troopsMax: 0, wheatMax: 0, max: 0 };
  return { plan, march, range };
};

export const ReinforceSheet = ({
  realm,
  army,
  post,
  onClose,
}: {
  realm: NativeRows["Structure"];
  army: DockArmy;
  post?: SupplyPostName;
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
      label={REINFORCE.title(army.label)}
      cue={post && <HudChip icons={[TARGET_MARKS.Camp.icon]}>{post.name}</HudChip>}
      onClose={onClose}
    >
      {plan && (
        <>
          <ArmyGain army={army} before={plan.current} gain={shown} />
          <div className="reinforce-size">
            <SizeRow
              label={DEPLOY_WORDS.howMany(TROOPS)}
              value={shown}
              most={range.wheatMax}
              max={range.max}
              disabled={range.wheatMax === 0 || sending}
              onChange={(next) => setCount(range.max > 0 && next === range.max ? "max" : next)}
            />
          </div>
        </>
      )}
      {plan && march && <ReinforceLimit plan={plan} march={march} wheatStop={wheatStop} />}
      {plan && <ReinforceSource stock={plan.stock} post={post !== undefined} />}
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

const ReinforceSource = ({ stock, post }: { stock: number; post: boolean }) => (
  <div className="reinforce-source">
    <HudLine icon="troops" line={REINFORCE.stockReady(formatExact(stock))} />
    {post && <SupplyPostEnds />}
  </div>
);

export const SupplyPostEnds = () => {
  const { setup } = useGame();
  const rules = readExpeditionRules(setup.store, configManager.getActiveGameId());
  const now = useNowSeconds();
  return <HudLine icon="hourglass" line={SUPPLY_POST.endsIn(rules ? dayClock(rules, now).secondsLeft : undefined)} />;
};

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
  if (wheatStop.troops > 0)
    return <HudLine icon="wheat" line={wheatForOnly(formatExact(wheatStop.troops), formatExact(wheatStop.of))} />;
  const line = shortfallLine({
    kind: "short",
    of: "wheat",
    held: plan.raise.wheat,
    need: plan.raise.wheatToGo(1, march),
    wait: undefined,
  });
  return <HudNotice tone="bad" icon="wheat" line={line} />;
};
