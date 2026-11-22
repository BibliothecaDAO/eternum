import { useEffect, useState } from "react";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";
import { useDockArmies, type DockArmy } from "../hud/dock-armies";
import type { Account } from "starknet";
import { DEEP_DEPTH, heldOaths, oathCards, oathPassStamina, oathRerollIndex } from "@bibliothecadao/eternum";
import { nativeFragmentConstants, nativeOathConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useGame } from "@/hooks/context/game-context";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import {
  HudButton,
  HudCard,
  HudChip,
  HudModalLayer,
  HudPortrait,
  HudWindow,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { Icon } from "@/ui/design-system/icon";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { toast } from "@/ui/features/event-feed/notify";
import {
  formatAmount,
  formatCount,
  formatShort,
  FRAGMENT,
  FRAGMENTS,
  FRONTIER_TROOP_NAMES,
  type TroopType,
} from "@bibliothecadao/types";
import { useFragmentsHeld } from "../value/fragments";
import { oathEffectDescription, oathJob, oathName } from "./oath-details";
import { OathSlotPips } from "./oath-slots";

const REDRAW_COST = nativeFragmentConstants.OATH_REROLL_FRAGMENTS;
const REDRAW_PRICE = formatCount(REDRAW_COST, FRAGMENT, FRAGMENTS);

export function FrontierOathPick({ realm }: { realm: NativeRows["Structure"] | null }) {
  const { store } = useNativeFacts(["ArmyProgress"]);
  const allowed = useUIStore(canIssueOrders);
  const armies = useDockArmies(realm);
  const fragments = useFragmentsHeld();
  const waiting = allowed
    ? armies.flatMap((army) => {
        const progress = store.get("ArmyProgress", {
          game_id: configManager.getActiveGameId(),
          explorer_id: army.explorerId,
        });
        return progress && progress.oath_pick !== 0 ? [{ army, progress }] : [];
      })[0]
    : undefined;
  const explorerId = waiting?.army.explorerId;
  useEffect(() => {
    if (explorerId === undefined) return;
    useUIStore.getState().selectOnMap({ kind: "army", entityId: explorerId, tile: "own" });
  }, [explorerId]);
  if (!waiting) return null;
  return (
    <HudModalLayer>
      <ArmyOathPick
        key={`${explorerId}:${waiting.progress.oath_pick}`}
        army={waiting.army}
        progress={waiting.progress}
        fragments={waiting.army.ethereal === DEEP_DEPTH ? null : fragments}
      />
    </HudModalLayer>
  );
}

function OathChoiceCard({
  id,
  disabled,
  onSelect,
  replace,
  redraw,
}: {
  id: number;
  disabled: boolean;
  onSelect: () => void;
  replace?: boolean;
  redraw?: { index: number; disabled: boolean; onRedraw: () => void };
}) {
  const name = oathName(id);
  return (
    <HudCard
      variant="oath"
      tone={oathJob(id)}
      title={name}
      picture={<Icon name={orderMeaning(id)} size={105} className="size-full" />}
      detail={oathEffectDescription(id)}
      disabled={disabled}
      onClick={onSelect}
      data-oath-id={replace ? undefined : id}
      chooseProps={replace ? { "data-replace-oath": id, "aria-label": `Replace ${name}` } : undefined}
      below={
        redraw && (
          <HudButton
            kind="secondary"
            size="sm"
            disabled={redraw.disabled}
            onClick={redraw.onRedraw}
            data-reroll-oath={redraw.index}
            aria-label={`Redraw ${name} for ${REDRAW_PRICE}`}
          >
            <span className="ui-oath-card__redraw-label">
              <span className="ui-oath-card__redraw-word">Redraw · </span>
              <Icon name="fragment" size={14} />
              <span className="tabular-nums">{REDRAW_COST}</span>
            </span>
          </HudButton>
        )
      }
    />
  );
}

function ArmyOathPick({
  army,
  progress,
  fragments,
}: {
  army: DockArmy;
  progress: NativeRows["ArmyProgress"];
  fragments: number | null;
}) {
  const { setup, account } = useGame();
  const allowed = useUIStore(canIssueOrders);
  const sending = useInFlight("army", army.explorerId) !== undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const held = heldOaths(progress.oaths);
  const full = held.length === progress.oath_slots;
  const stamina = army.stamina;
  const passResult = stamina && oathPassStamina(stamina.current, stamina.max);
  const troopLabel = FRONTIER_TROOP_NAMES[army.troopsFact.category as TroopType];
  const armyLine = `${army.label} · ${formatAmount(army.troops)} ${troopLabel}`;
  const heading = picked === null ? "Choose an Oath" : "Choose an Oath to replace";

  const choose = (oath: number | null, replace: number | null = null) =>
    sendOnce("army", army.explorerId, { order: "use" }, () =>
      setup.systemCalls.choose_oath({
        signer: account.account as unknown as Account,
        explorerId: army.explorerId,
        expectedPick: progress.oath_pick,
        oath,
        replace,
      }),
    ).catch((error: unknown) => toast.failed(error, "The Oath could not be chosen."));

  const reroll = (index: number) =>
    sendOnce("army", army.explorerId, { order: "use" }, () =>
      setup.systemCalls.reroll_oath({
        signer: account.account as unknown as Account,
        explorerId: army.explorerId,
        expectedPick: progress.oath_pick,
        index,
      }),
    ).catch((error: unknown) => toast.failed(error, "The card could not be redrawn."));

  return (
    <HudWindow
      title={heading}
      subtitle={armyLine}
      className="ui-oath-pick"
      data-oath-pick={progress.oath_pick}
      data-oath-held={progress.oaths}
      lead={
        <span className="ui-oath-pick__portrait">
          <HudPortrait icon={army.art} label={army.label} />
        </span>
      }
      cue={
        <div className="ui-oath-pick__meta">
          {fragments !== null && (
            <HudChip icons={["fragment"]} label={formatCount(fragments, FRAGMENT, FRAGMENTS)}>
              {formatShort(fragments)}
            </HudChip>
          )}
          <OathSlotPips held={held} slots={progress.oath_slots} />
        </div>
      }
    >
      {picked === null ? (
        <div className="ui-oath-pick__cards">
          {oathCards(progress.oath_pick).map((id) => {
            const rerollIndex = oathRerollIndex(progress.oath_pick, progress.oaths, id);
            return (
              <OathChoiceCard
                key={id}
                id={id}
                disabled={!allowed || sending}
                onSelect={() => (full ? setPicked(id) : choose(id))}
                redraw={
                  rerollIndex !== null && fragments !== null
                    ? {
                        index: rerollIndex,
                        disabled: !allowed || sending || fragments < REDRAW_COST,
                        onRedraw: () => reroll(rerollIndex),
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="ui-oath-pick__replace">
          {held.map((id) => (
            <OathChoiceCard
              key={id}
              id={id}
              replace
              disabled={!allowed || sending}
              onSelect={() => choose(picked, id)}
            />
          ))}
          <HudButton kind="secondary" disabled={sending} onClick={() => setPicked(null)}>
            Choose another
          </HudButton>
        </div>
      )}
      <HudWindowFoot>
        <HudButton
          kind="secondary"
          icon="stamina"
          disabled={!allowed || sending || !stamina}
          onClick={() => choose(null)}
          data-oath-pass=""
          data-oath-pass-current={stamina?.current}
          data-oath-pass-maximum={stamina?.max}
          data-oath-pass-result={passResult}
        >
          Pass: +{nativeOathConstants.PASS_STAMINA} stamina
          {stamina && (
            <span className="text-hud-muted">
              {stamina.current} → {passResult}
              <span className="ui-oath-pick__pass-max"> / {stamina.max}</span>
            </span>
          )}
        </HudButton>
      </HudWindowFoot>
    </HudWindow>
  );
}
