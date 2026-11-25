import "./deploy-view.css";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { OATH_SLOTS_MAX } from "@bibliothecadao/eternum";
import { type TroopType, formatExact, formatShort, formatWait } from "@bibliothecadao/types";
import {
  HudButton,
  HudChip,
  HudNotice,
  HudPrice,
  HudSheet,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
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
  RESEARCH_TREE,
  STAMINA,
  TROOPS,
  wheatForOnly,
} from "@/ui/design-system/kit/words";

import { SizeRow } from "../size-row";
import type { SlotStart } from "./deploy-plan";

export interface DeployTroopChoiceView {
  category: TroopType;
  name: string;
  art: IconMeaning;
  atHome: number;
}

/**
 * Raise an army in one sheet (Opus's deploy): the troop, how many, its slot and the Oaths it can hold, then one gold
 * Deploy naming the count with the wheat it burns beside it. The stamina it starts on stands in the head.
 */
export const DeployView = ({
  troopSelection,
  oathSlots,
  art,
  troopsAtHome,
  count,
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
  oathSlots: number | undefined;
  troopSelection?: {
    choices: readonly DeployTroopChoiceView[];
    selected: TroopType | undefined;
    onPick: (category: TroopType) => void;
  };
  art: IconMeaning | undefined;
  troopsAtHome: number | undefined;
  count: number | undefined;
  amount: { most: number; max: number };
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
  const troopName =
    troopSelection?.choices.find(({ category }) => category === troopSelection.selected)?.name ?? TROOPS;
  return (
    <HudSheet label={DEPLOY} cue={start?.start && <StartChip stamina={start.start.current} />} onClose={onClose}>
      {troopSelection && troopSelection.choices.length > 0 && (
        <TroopChoices
          choices={troopSelection.choices}
          selected={troopSelection.selected}
          onPick={troopSelection.onPick}
        />
      )}
      {amount.most > 0 && (
        <div className="deploy-size">
          <SizeRow
            label={DEPLOY_WORDS.howMany(troopName)}
            value={count ?? 0}
            most={amount.most}
            max={amount.max}
            count
            onChange={onCount}
          />
        </div>
      )}
      {slots.open && slots.open.length > 0 && (
        <div className="deploy-slots">
          <span className="deploy-slots__label">{DEPLOY_WORDS.slot}</span>
          <DeploySlots open={slots.open} picked={start?.slot} onPick={slots.onPick} />
          {oathSlots !== undefined && (
            <>
              <span className="deploy-slots__label deploy-slots__label--end">{DEPLOY_WORDS.oaths}</span>
              <OathCapacity slots={oathSlots} />
            </>
          )}
        </div>
      )}
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
      {wheatLimit && <WheatLimit limit={wheatLimit} onGoToRealm={onGoToRealm} />}
      {canDeploy && wheatCost !== undefined && (
        <HudWindowFoot note={<HudPrice prices={[{ of: "wheat", amount: wheatCost }]} />}>
          <HudButton
            kind="primary"
            icon={art}
            aria-label={sending ? undefined : DEPLOY}
            disabled={!count}
            busy={sending ? DEPLOYING : undefined}
            onClick={onDeploy}
          >
            {DEPLOY_WORDS.deployCount(count ?? 0)}
          </HudButton>
        </HudWindowFoot>
      )}
    </HudSheet>
  );
};

const StartChip = ({ stamina }: { stamina: number }) => (
  <span data-deploy-start>
    <HudChip icons={["stamina"]} label={`${DEPLOY_WORDS.startsOn} ${STAMINA}`}>
      {formatShort(stamina)}
    </HudChip>
  </span>
);

const TroopChoices = ({
  choices,
  selected,
  onPick,
}: {
  choices: readonly DeployTroopChoiceView[];
  selected: TroopType | undefined;
  onPick: (category: TroopType) => void;
}) => (
  <div role="group" aria-label={DEPLOY_WORDS.troopType} className="deploy-troops">
    {choices.map((choice) => (
      <button
        key={choice.category}
        type="button"
        className="ui-pick deploy-troop-card"
        aria-label={choice.name}
        aria-pressed={selected === choice.category}
        onClick={() => onPick(choice.category)}
      >
        <Icon name={choice.art} size={46} />
        <span className="deploy-troop-card__name">{choice.name}</span>
        <span className="deploy-troop-card__home">{formatExact(choice.atHome)}</span>
      </button>
    ))}
  </div>
);

const DeploySlots = ({
  open,
  picked,
  onPick,
}: {
  open: SlotStart[];
  picked: number | undefined;
  onPick: (slot: number) => void;
}) => (
  <div role="group" aria-label="Army slots" className="deploy-slots__pips">
    {open.map((slot) => (
      <button
        key={slot.slot}
        type="button"
        className="ui-pick deploy-slot"
        aria-label={`${ARMY} ${slot.number}`}
        aria-pressed={slot.slot === picked}
        onClick={() => onPick(slot.slot)}
      >
        {formatExact(slot.number)}
      </button>
    ))}
  </div>
);

/** The Oaths a new army of this troop can hold: an open socket each, and a lock for the next one research opens. */
const OathCapacity = ({ slots }: { slots: number }) => (
  <span role="img" aria-label={RESEARCH_TREE.oathSlots(slots)} className="deploy-oaths">
    {Array.from({ length: slots }, (_, index) => (
      <i key={index} className="deploy-oath" data-open="">
        +
      </i>
    ))}
    {slots < OATH_SLOTS_MAX && (
      <i className="deploy-oath" data-locked="">
        <Icon name="lock" size={12} />
      </i>
    )}
  </span>
);

const WheatLimit = ({
  limit,
  onGoToRealm,
}: {
  limit: { troops: number; of: number; held: number; perTroop: number; wait: number | undefined };
  onGoToRealm: () => void;
}) => (
  <HudNotice
    tone="bad"
    icon="wheat"
    line={
      limit.troops === 0
        ? shortfallLine({ kind: "short", of: "wheat", held: limit.held, need: limit.perTroop, wait: limit.wait })
        : wheatForOnly(formatExact(limit.troops), formatExact(limit.of))
    }
    fix={{ label: GET_WHEAT, onClick: onGoToRealm }}
  />
);
