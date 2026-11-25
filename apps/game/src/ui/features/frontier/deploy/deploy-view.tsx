import "./deploy-view.css";

import { useState, type ReactNode } from "react";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { type TroopType, formatAmount, formatExact, formatWait } from "@bibliothecadao/types";
import {
  HudButton,
  HudCost,
  HudMeter,
  HudNotice,
  HudSheet,
  HudTroopAmount,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { costLine } from "@/ui/design-system/kit/price-faces";
import { shortfallLine } from "@/ui/design-system/kit/reasons";
import {
  ARMY,
  BUILD,
  DEPLOY,
  DEPLOY_WORDS,
  DEPLOYING,
  GET_WHEAT,
  NO_OPEN_TILE,
  NO_TROOPS_AT_HOME,
  noTroopsUntil,
  TROOPS,
  wheatForOnly,
} from "@/ui/design-system/kit/words";

import { OpenSlot } from "../hud/army-token";
import type { SlotStart } from "./deploy-plan";
import { slotStartLine } from "./slot-start";

export interface DeployTroopChoiceView {
  category: TroopType;
  name: string;
  art: IconMeaning;
  atHome: number;
}

export const DeployView = ({
  troopSelection,
  oathSlots,
  art,
  troopsAtHome,
  count,
  isFullStack,
  allowedSlots,
  amount,
  onCount,
  start,
  slots,
  troopsWait,
  wheatCost,
  tile,
  canDeploy,
  sending,
  onDeploy,
  wheatLimit,
  onGoToRealm,
  onClose,
}: {
  oathSlots?: ReactNode;
  troopSelection?: {
    choices: readonly DeployTroopChoiceView[];
    selected: TroopType | undefined;
    onPick: (category: TroopType) => void;
  };
  art: IconMeaning | undefined;
  troopsAtHome: number | undefined;
  count: number | undefined;
  isFullStack: boolean;
  allowedSlots?: number;
  amount: { most: number; max: number; held: number };
  onCount: (count: number) => void;
  start: SlotStart | undefined;
  slots: { open: SlotStart[] | undefined; onPick: (slot: number) => void };
  troopsWait: number | undefined;
  wheatCost: number | undefined;
  tile: "open" | "none" | undefined;
  canDeploy: boolean;
  sending: boolean;
  onDeploy: () => void;
  wheatLimit: { troops: number; of: number; held: number; perTroop: number; wait: number | undefined } | undefined;
  onGoToRealm: () => void;
  onClose: () => void;
}) => {
  const [adjusting, setAdjusting] = useState(false);
  const totalSlots = allowedSlots ?? slots.open?.length ?? start?.number ?? 0;
  const troopName =
    troopSelection?.choices.find(({ category }) => category === troopSelection.selected)?.name ?? TROOPS;

  return (
    <HudSheet label={DEPLOY} icon="military" onClose={onClose}>
      {start?.start && totalSlots > 0 && (
        <div className="deploy-sheet__sub">
          <span>{DEPLOY_WORDS.slotOf(start.number, totalSlots)}</span>
          <span aria-hidden="true">·</span>
          <span className="deploy-sheet__stamina">
            <Icon name="stamina" size={14} />
            <span>{`${formatAmount(start.start.current)}/${formatAmount(start.start.max)}`}</span>
          </span>
        </div>
      )}
      {troopSelection && troopSelection.choices.length > 0 && (
        <div role="group" aria-label="Troop type" className="deploy-troops">
          {troopSelection.choices.map((choice) => (
            <button
              key={choice.category}
              type="button"
              className="ui-pick deploy-troop-card"
              aria-label={choice.name}
              aria-pressed={troopSelection.selected === choice.category}
              onClick={() => {
                setAdjusting(false);
                troopSelection.onPick(choice.category);
              }}
            >
              <span className="deploy-troop-card__portrait">
                <Icon name={choice.art} size={44} />
              </span>
              <span className="deploy-troop-card__name">{choice.name}</span>
              <span className="deploy-troop-card__ready">{DEPLOY_WORDS.ready(choice.atHome)}</span>
            </button>
          ))}
        </div>
      )}
      {amount.most > 0 && (
        <div className="deploy-size">
          <div className="deploy-size-bar">
            <span className="deploy-size-bar__state">
              <span>{DEPLOY_WORDS.troopCount}</span>
              <span className="deploy-size-bar__count">
                {DEPLOY_WORDS.countOf(count ?? 0, amount.max, troopName, isFullStack)}
              </span>
            </span>
            <button
              type="button"
              className="deploy-adjust-toggle"
              aria-expanded={adjusting}
              onClick={() => setAdjusting((open) => !open)}
            >
              {adjusting ? DEPLOY_WORDS.hideSize : DEPLOY_WORDS.adjustSize}
            </button>
          </div>
          {!adjusting && (
            <div className="w-full">
              <HudMeter
                share={amount.max > 0 ? (count ?? 0) / amount.max : 0}
                label={DEPLOY_WORDS.countOf(count ?? 0, amount.max, troopName, isFullStack)}
              />
            </div>
          )}
          {adjusting && (
            <HudTroopAmount
              name={TROOPS}
              art={art}
              value={count ?? 0}
              most={amount.most}
              max={amount.max}
              held={amount.held}
              disabled={amount.most === 0}
              onChange={onCount}
            />
          )}
        </div>
      )}
      <div className="deploy-slots-row">
        {slots.open && slots.open.length > 0 && (slots.open.length > 1 || !start) && (
          <DeploySlots open={slots.open} picked={start?.slot} onPick={slots.onPick} />
        )}
        {oathSlots}
      </div>
      {troopsAtHome === 0 ? (
        troopsWait === undefined ? (
          <>
            <HudNotice tone="warn" line={NO_TROOPS_AT_HOME} />
            <HudButton kind="primary" icon="barracks" onClick={onGoToRealm}>
              {BUILD}
            </HudButton>
          </>
        ) : (
          <HudNotice tone="warn" line={noTroopsUntil(formatWait(troopsWait))} />
        )
      ) : (
        tile === "none" && <HudNotice tone="warn" line={NO_OPEN_TILE} />
      )}
      {wheatLimit && (
        <HudNotice
          tone="bad"
          icon="wheat"
          line={
            wheatLimit.troops === 0
              ? shortfallLine({
                  kind: "short",
                  of: "wheat",
                  held: wheatLimit.held,
                  need: wheatLimit.perTroop,
                  wait: wheatLimit.wait,
                })
              : wheatForOnly(formatExact(wheatLimit.troops), formatExact(wheatLimit.of))
          }
          fix={{ label: GET_WHEAT, onClick: onGoToRealm }}
        />
      )}
      {canDeploy && wheatCost !== undefined && (
        <HudWindowFoot note={<HudCost line={costLine([{ of: "wheat", amount: wheatCost }])} />}>
          <HudButton
            kind="primary"
            icon="military"
            aria-label={sending ? undefined : DEPLOY}
            disabled={!count}
            busy={sending ? DEPLOYING : undefined}
            onClick={onDeploy}
          >
            {DEPLOY_WORDS.deployCount(count ?? 0, troopName)}
          </HudButton>
        </HudWindowFoot>
      )}
    </HudSheet>
  );
};

const DeploySlots = ({
  open,
  picked,
  onPick,
}: {
  open: SlotStart[];
  picked: number | undefined;
  onPick: (slot: number) => void;
}) => (
  <div role="group" aria-label="Army slots" className="flex gap-1.5">
    {open.map((slot) => (
      <OpenSlot
        key={slot.slot}
        label={`${ARMY} ${slot.number}`}
        pulse={false}
        tip={slotStartLine(slot)}
        bar={slot.start}
        selected={slot.slot === picked}
        onDeploy={() => onPick(slot.slot)}
      />
    ))}
  </div>
);
