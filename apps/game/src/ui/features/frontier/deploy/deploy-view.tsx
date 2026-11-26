import "./deploy-view.css";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { type TroopType, formatExact, formatWait } from "@bibliothecadao/types";
import {
  HudButton,
  HudLine,
  HudNotice,
  HudPrice,
  HudSheet,
  HudStamina,
  HudWindowFoot,
  type StaminaBar,
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
  TROOP_TRAIT_WORDS,
  TROOPS,
  type TroopFigures,
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

export const DeployView = ({
  troopSelection,
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
  troopSelection?: {
    choices: readonly DeployTroopChoiceView[];
    selected: TroopType | undefined;
    onPick: (category: TroopType) => void;
    figures: TroopFigures;
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
    <HudSheet label={DEPLOY} cue={start?.start && <StartBar stamina={start.start} />} onClose={onClose}>
      {troopSelection && troopSelection.choices.length > 0 && <TroopChoices {...troopSelection} />}
      {amount.most > 0 && (
        <div className="deploy-size">
          <SizeRow
            label={DEPLOY_WORDS.howMany(troopName)}
            value={count ?? 0}
            most={amount.most}
            max={amount.max}
            onChange={onCount}
          />
          {wheatLimit && wheatLimit.troops > 0 && (
            <HudLine icon="wheat" line={wheatForOnly(formatExact(wheatLimit.troops), formatExact(wheatLimit.of))} />
          )}
        </div>
      )}
      {slots.open && slots.open.length > 0 && (
        <div className="deploy-slots">
          <span className="deploy-slots__label">{DEPLOY_WORDS.slot}</span>
          <DeploySlots open={slots.open} picked={start?.slot} onPick={slots.onPick} />
        </div>
      )}
      {troopsAtHome === 0 ? (
        troopsWait === undefined ? (
          <>
            <HudNotice tone="bad" line={NO_TROOPS_AT_HOME} />
            <HudButton kind="primary" icon="barracks" onClick={onGoToRealm}>
              {BUILD}
            </HudButton>
          </>
        ) : (
          <HudNotice tone="bad" line={noTroopsUntil(formatWait(troopsWait))} />
        )
      ) : (
        tile === "none" && <HudNotice tone="warn" line={NO_OPEN_TILE} />
      )}
      {wheatLimit?.troops === 0 && <WheatShort limit={wheatLimit} onGoToRealm={onGoToRealm} />}
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

const StartBar = ({ stamina }: { stamina: StaminaBar }) => (
  <span data-deploy-start className="deploy-start">
    <HudStamina stamina={stamina} />
  </span>
);

const TRAIT_MARK = { Knight: null, Crossbowman: null, Paladin: "stamina" } satisfies Record<
  TroopType,
  IconMeaning | null
>;

const TroopChoices = ({
  choices,
  selected,
  onPick,
  figures,
}: {
  choices: readonly DeployTroopChoiceView[];
  selected: TroopType | undefined;
  onPick: (category: TroopType) => void;
  figures: TroopFigures;
}) => (
  <>
    <div role="group" aria-label={DEPLOY_WORDS.troopType} className="deploy-troops">
      {choices.map((choice) => (
        <button
          key={choice.category}
          type="button"
          className="ui-pick deploy-troop-card"
          aria-label={choice.name}
          aria-pressed={selected === choice.category}
          data-tip={TROOP_TRAIT_WORDS[choice.category].tip(figures)}
          onClick={() => onPick(choice.category)}
        >
          <Icon name={choice.art} size={46} />
          <span className="deploy-troop-card__name">{choice.name}</span>
          <span className="deploy-troop-card__home">{formatExact(choice.atHome)}</span>
          <TroopTraitLine category={choice.category} figures={figures} />
        </button>
      ))}
    </div>
    {selected !== undefined && (
      <p data-troop-summary="" className="deploy-troop-summary">
        {TROOP_TRAIT_WORDS[selected].summary(figures)}
      </p>
    )}
  </>
);

const TroopTraitLine = ({ category, figures }: { category: TroopType; figures: TroopFigures }) => {
  const mark = TRAIT_MARK[category];
  return (
    <span data-troop-trait="" className="deploy-troop-card__trait">
      {mark && <Icon name={mark} size={12} />}
      {TROOP_TRAIT_WORDS[category].card(figures)}
    </span>
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

const WheatShort = ({
  limit,
  onGoToRealm,
}: {
  limit: { troops: number; of: number; held: number; perTroop: number; wait: number | undefined };
  onGoToRealm: () => void;
}) => (
  <HudNotice
    tone="bad"
    icon="wheat"
    line={shortfallLine({ kind: "short", of: "wheat", held: limit.held, need: limit.perTroop, wait: limit.wait })}
    fix={{ label: GET_WHEAT, onClick: onGoToRealm }}
  />
);
