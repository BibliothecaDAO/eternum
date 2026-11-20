import { useEffect, useState } from "react";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";
import { useDockArmies } from "../hud/dock-armies";
import type { Account } from "starknet";
import { DEEP_DEPTH, heldOaths, oathCards, oathPassStamina, oathRerollIndex } from "@bibliothecadao/eternum";
import { nativeFragmentConstants, nativeOathConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useGame } from "@/hooks/context/game-context";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { HudButton, HudCard, HudModalLayer, HudWindow } from "@/ui/design-system/kit/hud-elements";
import { Icon } from "@/ui/design-system/icon";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { toast } from "@/ui/features/event-feed/notify";
import { formatCount, FRAGMENT, FRAGMENTS } from "@bibliothecadao/types";
import { useFragmentsHeld } from "../value/fragments";
import { oathEffectDescription, oathName } from "./oath-details";

const REDRAW_PRICE = formatCount(nativeFragmentConstants.OATH_REROLL_FRAGMENTS, FRAGMENT, FRAGMENTS);

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
      <HudWindow title={waiting.army.label} size="task">
        <ArmyOathPick
          key={`${explorerId}:${waiting.progress.oath_pick}`}
          explorerId={waiting.army.explorerId}
          progress={waiting.progress}
          stamina={waiting.army.stamina}
          fragments={waiting.army.ethereal === DEEP_DEPTH ? null : fragments}
        />
      </HudWindow>
    </HudModalLayer>
  );
}

function ArmyOathPick({
  explorerId,
  progress,
  stamina,
  fragments,
}: {
  explorerId: number;
  progress: NativeRows["ArmyProgress"];
  stamina: { current: number; max: number } | undefined;
  fragments: number | null;
}) {
  const { setup, account } = useGame();
  const allowed = useUIStore(canIssueOrders);
  const sending = useInFlight("army", explorerId) !== undefined;
  const [picked, setPicked] = useState<number | null>(null);
  const held = heldOaths(progress.oaths);
  const full = held.length === progress.oath_slots;
  const passResult = stamina && oathPassStamina(stamina.current, stamina.max);
  const choose = (oath: number | null, replace: number | null = null) =>
    sendOnce("army", explorerId, { order: "use" }, () =>
      setup.systemCalls.choose_oath({
        signer: account.account as unknown as Account,
        explorerId,
        expectedPick: progress.oath_pick,
        oath,
        replace,
      }),
    ).catch((error: unknown) => toast.failed(error, "The Oath could not be chosen."));
  const reroll = (index: number) =>
    sendOnce("army", explorerId, { order: "use" }, () =>
      setup.systemCalls.reroll_oath({
        signer: account.account as unknown as Account,
        explorerId,
        expectedPick: progress.oath_pick,
        index,
      }),
    ).catch((error: unknown) => toast.failed(error, "The card could not be redrawn."));

  return (
    <section
      aria-label="Choose an Oath"
      className="flex flex-col gap-2"
      data-oath-pick={progress.oath_pick}
      data-oath-held={progress.oaths}
    >
      <span className="text-hud-label text-hud-ink">
        {picked === null ? "Choose an Oath" : "Choose an Oath to replace"}
      </span>
      {picked === null ? (
        <div className="grid grid-cols-3 gap-1">
          {oathCards(progress.oath_pick).map((id) => {
            const rerollIndex = oathRerollIndex(progress.oath_pick, progress.oaths, id);
            return (
              <div key={id} data-oath-id={id} className="flex min-w-0 flex-col gap-1">
                <HudCard
                  size="sm"
                  title={oathName(id)}
                  picture={<Icon name={orderMeaning(id)} size={40} />}
                  detail={oathEffectDescription(id)}
                  disabled={!allowed || sending}
                  onClick={() => (full ? setPicked(id) : choose(id))}
                />
                {rerollIndex !== null && fragments !== null && (
                  <HudButton
                    kind="secondary"
                    disabled={!allowed || sending || fragments < nativeFragmentConstants.OATH_REROLL_FRAGMENTS}
                    onClick={() => reroll(rerollIndex)}
                    data-reroll-oath={rerollIndex}
                    aria-label={`Redraw ${oathName(id)} for ${REDRAW_PRICE}`}
                  >
                    Redraw: {REDRAW_PRICE}
                  </HudButton>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {held.map((id) => (
            <HudButton
              key={id}
              kind="secondary"
              disabled={!allowed || sending}
              onClick={() => choose(picked, id)}
              data-replace-oath={id}
              aria-label={`Replace ${oathName(id)}`}
            >
              <Icon name={orderMeaning(id)} />
              {oathName(id)}
            </HudButton>
          ))}
          <HudButton kind="secondary" disabled={sending} onClick={() => setPicked(null)}>
            Choose another
          </HudButton>
        </div>
      )}
      <HudButton
        kind="secondary"
        disabled={!allowed || sending || !stamina}
        onClick={() => choose(null)}
        data-oath-pass-current={stamina?.current}
        data-oath-pass-maximum={stamina?.max}
        data-oath-pass-result={passResult}
      >
        Pass: +{nativeOathConstants.PASS_STAMINA} stamina
        {stamina && (
          <span className="text-hud-muted">
            {stamina.current} → {passResult} / {stamina.max}
          </span>
        )}
      </HudButton>
    </section>
  );
}
