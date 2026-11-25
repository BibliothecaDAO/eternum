import "./oath-pick.css";

import { useState, type CSSProperties } from "react";
import { create } from "zustand";
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
import { aspectVariables } from "@/tokens";
import { HudButton, HudChip, HudModalLayer, HudPortrait } from "@/ui/design-system/kit/hud-elements";
import { OATH_PICK } from "@/ui/design-system/kit/words";
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
  orderAspect,
  type TroopType,
} from "@bibliothecadao/types";
import { useFragmentsHeld } from "../value/fragments";
import type { PickEffectBase } from "../pick-effect-format";
import { usePickEffectBase } from "../pick-effect-text";
import { oathEffectDescription, oathName, oathStatBadge } from "./oath-details";

const REDRAW_COST = nativeFragmentConstants.OATH_REROLL_FRAGMENTS;
const REDRAW_PRICE = formatCount(REDRAW_COST, FRAGMENT, FRAGMENTS);

const useWaitingPick = (explorerId: number) => {
  const { store } = useNativeFacts(["ArmyProgress"]);
  const progress = store.get("ArmyProgress", { game_id: configManager.getActiveGameId(), explorer_id: explorerId });
  return progress && progress.oath_pick !== 0 ? progress : undefined;
};

export const useOathWaiting = (explorerId: number) => useWaitingPick(explorerId) !== undefined;

const useHeldPicks = create<{ held: ReadonlySet<number> }>(() => ({ held: new Set() }));

export const holdOathPick = (explorerId: number, ms: number) => {
  useHeldPicks.setState(({ held }) => ({ held: new Set([...held, explorerId]) }));
  setTimeout(
    () => useHeldPicks.setState(({ held }) => ({ held: new Set([...held].filter((id) => id !== explorerId)) })),
    ms,
  );
};

export function FrontierOathPick({ realm }: { realm: NativeRows["Structure"] | null }) {
  const allowed = useUIStore(canIssueOrders);
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const army = useDockArmies(realm).find(({ explorerId }) => explorerId === selectedId);
  const fragments = useFragmentsHeld();
  if (!allowed || !army) return null;
  return <WaitingOathPick army={army} fragments={army.ethereal === DEEP_DEPTH ? null : fragments} />;
}

const WaitingOathPick = ({ army, fragments }: { army: DockArmy; fragments: number | null }) => {
  const progress = useWaitingPick(army.explorerId);
  const held = useHeldPicks((state) => state.held.has(army.explorerId));
  if (!progress || held) return null;
  return (
    <HudModalLayer>
      <ArmyOathPick key={army.explorerId} army={army} progress={progress} fragments={fragments} />
    </HudModalLayer>
  );
};

function OathChoice({
  id,
  pickBase,
  chosen,
  fresh,
  disabled,
  onChoose,
  swap,
}: {
  id: number;
  pickBase: PickEffectBase;
  chosen: boolean;
  fresh: boolean;
  disabled: boolean;
  onChoose: () => void;
  swap?: { index: number; disabled: boolean; onSwap: () => void };
}) {
  const name = oathName(id);
  return (
    <div
      className="ui-pick oath-choice"
      data-selected={chosen || undefined}
      data-fresh={fresh || undefined}
      style={aspectOf(id)}
    >
      <button
        type="button"
        className="oath-choice__pick"
        data-oath-id={id}
        aria-label={chosen ? OATH_PICK.chosen(name) : name}
        disabled={disabled}
        onClick={onChoose}
        title={oathEffectDescription(id, pickBase)}
      >
        <OathFace id={id} pickBase={pickBase} />
      </button>
      {fresh ? (
        <span className="oath-choice__new">
          <HudChip tone="good">{OATH_PICK.fresh}</HudChip>
        </span>
      ) : (
        swap && (
          <button
            type="button"
            className="oath-choice__swap"
            disabled={swap.disabled}
            onClick={swap.onSwap}
            data-reroll-oath={swap.index}
            aria-label={OATH_PICK.swapFor(name, REDRAW_PRICE)}
          >
            <Icon name="refresh" size={18} />
            <i>{OATH_PICK.swap}</i>
          </button>
        )
      )}
    </div>
  );
}

const OathFace = ({ id, pickBase }: { id: number; pickBase: PickEffectBase }) => {
  const badge = oathStatBadge(id, pickBase);
  return (
    <>
      <span className="oath-choice__ring" aria-hidden="true">
        <Icon name={orderMeaning(id)} size={36} />
      </span>
      <span className="oath-choice__words">
        <span className="oath-choice__line">
          <b className="oath-choice__name">{oathName(id)}</b>
          <span className="oath-choice__effect">
            <Icon name={badge.icon} size={17} />
            {badge.hero}
          </span>
        </span>
        <span className="oath-choice__unit">{badge.unit}</span>
      </span>
    </>
  );
};

const aspectOf = (id: number): CSSProperties | undefined => {
  const aspect = orderAspect(id);
  return aspect !== null ? (aspectVariables(aspect) as CSSProperties) : undefined;
};

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
  const baseFor = usePickEffectBase(army.explorerId);
  const allowed = useUIStore(canIssueOrders);
  const sending = useInFlight("army", army.explorerId) !== undefined;
  const [chosenAt, setChosenAt] = useState(0);
  const [swappedAt, setSwappedAt] = useState<number | null>(null);
  const [replacing, setReplacing] = useState(false);
  const held = heldOaths(progress.oaths);
  const full = held.length === progress.oath_slots;
  const cards = oathCards(progress.oath_pick);
  const chosen = cards[Math.min(chosenAt, cards.length - 1)];
  const redrawn = progress.oath_pick >= nativeOathConstants.REROLLED;
  const busy = !allowed || sending;
  const troopLabel = FRONTIER_TROOP_NAMES[army.troopsFact.category as TroopType];

  const choose = (oath: number | null, replace: number | null = null) =>
    sendOnce("army", army.explorerId, { order: "use" }, () =>
      setup.systemCalls.choose_oath({
        signer: account.account as unknown as Account,
        explorerId: army.explorerId,
        expectedPick: progress.oath_pick,
        oath,
        replace,
      }),
    ).catch((error: unknown) => toast.failed(error, OATH_PICK.notChosen));

  const reroll = (index: number) => {
    setSwappedAt(index);
    return sendOnce("army", army.explorerId, { order: "use" }, () =>
      setup.systemCalls.reroll_oath({
        signer: account.account as unknown as Account,
        explorerId: army.explorerId,
        expectedPick: progress.oath_pick,
        index,
      }),
    ).catch((error: unknown) => toast.failed(error, OATH_PICK.notRedrawn));
  };

  return (
    <section
      role="dialog"
      aria-label={replacing ? OATH_PICK.replaceTitle : OATH_PICK.title}
      className="ui ui-panel oath-pick"
      data-oath-pick={progress.oath_pick}
      data-oath-held={progress.oaths}
    >
      <header className="oath-pick__head">
        <HudPortrait icon={army.art} label={army.label} />
        <span className="oath-pick__title">
          <b>{replacing ? OATH_PICK.replaceTitle : OATH_PICK.title}</b>
          <span>
            {OATH_PICK.slotOf(
              Math.min(held.length + 1, progress.oath_slots),
              progress.oath_slots,
              formatAmount(army.troops),
              troopLabel,
            )}
          </span>
        </span>
        {fragments !== null &&
          (redrawn ? (
            <HudChip>{OATH_PICK.used}</HudChip>
          ) : (
            <HudChip icons={["refresh", "fragment"]} label={OATH_PICK.redrawPrice}>
              {formatShort(REDRAW_COST)}
            </HudChip>
          ))}
      </header>
      <div className="oath-pick__body">
        {replacing ? (
          <>
            {held.map((id) => (
              <div key={id} className="oath-choice" style={aspectOf(id)}>
                <button
                  type="button"
                  className="oath-choice__pick"
                  data-replace-oath={id}
                  aria-label={OATH_PICK.replace(oathName(id))}
                  disabled={busy}
                  onClick={() => choose(chosen, id)}
                >
                  <OathFace id={id} pickBase={baseFor(id)} />
                </button>
              </div>
            ))}
            <HudButton kind="secondary" disabled={sending} onClick={() => setReplacing(false)}>
              {OATH_PICK.another}
            </HudButton>
          </>
        ) : (
          <>
            {cards.map((id, index) => {
              const rerollIndex = oathRerollIndex(progress.oath_pick, progress.oaths, id);
              return (
                <OathChoice
                  key={id}
                  id={id}
                  pickBase={baseFor(id)}
                  chosen={id === chosen}
                  fresh={redrawn && swappedAt === index}
                  disabled={busy}
                  onChoose={() => setChosenAt(index)}
                  swap={
                    rerollIndex !== null && fragments !== null
                      ? {
                          index: rerollIndex,
                          disabled: busy || fragments < REDRAW_COST,
                          onSwap: () => void reroll(rerollIndex),
                        }
                      : undefined
                  }
                />
              );
            })}
            <PassRow stamina={army.stamina} disabled={busy} onPass={() => void choose(null)} />
          </>
        )}
      </div>
      {!replacing && chosen !== undefined && (
        <footer className="oath-pick__foot">
          <HudButton
            kind="primary"
            icon={orderMeaning(chosen)}
            disabled={busy}
            data-oath-swear={chosen}
            onClick={() => (full ? setReplacing(true) : choose(chosen))}
          >
            {OATH_PICK.swear(oathName(chosen))}
          </HudButton>
        </footer>
      )}
    </section>
  );
}

const PassRow = ({
  stamina,
  disabled,
  onPass,
}: {
  stamina: DockArmy["stamina"];
  disabled: boolean;
  onPass: () => void;
}) => {
  const result = stamina && oathPassStamina(stamina.current, stamina.max);
  return (
    <button
      type="button"
      className="oath-pick__pass"
      disabled={disabled || !stamina}
      onClick={onPass}
      data-oath-pass=""
      data-oath-pass-current={stamina?.current}
      data-oath-pass-maximum={stamina?.max}
      data-oath-pass-result={result}
    >
      <Icon name="stamina" size={17} />
      {OATH_PICK.pass} · <b className="oath-pick__gain">+{nativeOathConstants.PASS_STAMINA}</b>
      {stamina && (
        <>
          <Icon name="stamina" size={17} />
          <span className="oath-pick__bar">
            {formatAmount(stamina.current)} → {formatAmount(result)}
          </span>
        </>
      )}
    </button>
  );
};
