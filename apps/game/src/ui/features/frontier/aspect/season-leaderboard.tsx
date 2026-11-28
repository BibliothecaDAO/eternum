import "./season-leaderboard.css";

import { aspectName, aspects, formatCount, formatExact, formatShort, type AspectId } from "@bibliothecadao/types";
import { useState, type CSSProperties, type ReactNode } from "react";

import {
  boardRows,
  type GloryRoster,
  type GloryRow,
  type OwnGloryRow,
  unnamedMembers,
} from "@/shell/season-tab/glory-rows";
import { useHudLayout } from "@/hooks/helpers/use-compact-hud";
import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { aspectMeaning } from "@/ui/design-system/icon-meaning";
import {
  HudButton,
  HudChip,
  HudEmpty,
  HudMeter,
  HudPage,
  HudPlaceMedal,
  HudSkeleton,
  HudTableHead,
  HudTableRow,
  HudTabs,
} from "@/ui/design-system/kit/hud-elements";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import {
  ASPECT_PAGE_WORDS,
  PLAY_WORDS,
  RANK,
  SEASON_BOARD_WORDS as WORDS,
  SEASON_ERROR,
  SEASON_WORDS,
  TRY_AGAIN,
} from "@/ui/design-system/kit/words";
import { LordName } from "../board/realm-marks";
import { RefusedVerb } from "../refused-verb";

export interface SeasonAspect {
  aspectId: AspectId;
  rank: number;
  height: number;
  stage: number;
  pool: number;
  members: number;
  own: boolean;
}

export interface SeasonStanding {
  realm: string;
  aspectId: AspectId;
  aspectRank: number;
  order: { orderId: number; orderName: string } | null;
  glory: number;
  gloryRank: number | null;
  shares: boolean;
  pool: number;
  share: number;
  stage: number;
  triumphs: readonly { stage: keyof typeof ASPECT_PAGE_WORDS.triumph; day: number | null }[];
  altar: { charge: number; threshold: number } | null;
}

type GloryNames = "ready" | "loading" | { retry: () => void };

export interface SeasonLeaderboardProps {
  day?: { day: number; lastDay: number };
  players: number;
  race: readonly SeasonAspect[];
  finishHeight: number;
  stages: number;
  result: { winner: string | null } | null;
  rosters: readonly { aspect: AspectId; roster: GloryRoster }[];
  own: OwnGloryRow | null;
  standing: SeasonStanding | null;
  names: GloryNames;
  invite?: ReactNode;
  goToDeep?: { go: () => void } | { refused: Refusal };
  onClose: () => void;
}

const COLS = "2rem 1.25rem minmax(0, 1fr) 4rem";
const COLS_WIDE = "2.25rem 1.5rem minmax(0, 1fr) minmax(0, 9rem) 4.5rem";
const TRIUMPH_ICONS: Record<keyof typeof ASPECT_PAGE_WORDS.triumph, IconMeaning> = {
  1: "eye",
  2: "cloud-lightning",
  3: "moon",
  4: "chest",
};

export const SeasonLeaderboard = (props: SeasonLeaderboardProps) => {
  const [tab, setTab] = useState<AspectId | 0>(0);
  const [standingShown, setStandingShown] = useState(false);
  const phone = useHudLayout() === "phone";
  const { day, players, standing, onClose } = props;
  return (
    <HudPage
      label={phone ? WORDS.phoneTitle : WORDS.title}
      icon="crown"
      fills
      cue={
        <span className="season-board__cue">
          {day && <HudChip icons={["hourglass"]}>{WORDS.day(day.day, day.lastDay)}</HudChip>}
          {!phone && <HudChip icons={["people"]}>{formatCount(players, PLAY_WORDS.player)}</HudChip>}
          {!phone && <span className="season-board__rule">{WORDS.poolRule}</span>}
        </span>
      }
      onClose={onClose}
    >
      <div data-season-board className="season-board" data-standing={standingShown || undefined}>
        {props.result && (
          <span className="season-board__result" data-race-ended={props.result.winner === null ? "none" : "won"}>
            {props.result.winner === null ? ASPECT_PAGE_WORDS.noFinisher : ASPECT_PAGE_WORDS.won(props.result.winner)}
          </span>
        )}
        <AspectStrip race={props.race} finishHeight={props.finishHeight} stages={props.stages} phone={phone} />
        <div className="season-board__main">
          <section className="season-board__glory" aria-label={SEASON_WORDS.gloryLeaderboard}>
            <div className="season-board__tabs">
              <HudTabs<AspectId | 0>
                value={tab}
                onChange={setTab}
                tabs={[
                  { key: 0, label: SEASON_WORDS.allPlayers },
                  ...aspects.map(({ id, name }) =>
                    phone
                      ? { key: id, ariaLabel: name, title: name, icon: aspectMeaning(id) }
                      : { key: id, label: name, icon: aspectMeaning(id) },
                  ),
                ]}
              />
              {standing && (
                <span className="season-board__standing-tab">
                  <HudButton
                    kind="secondary"
                    size="sm"
                    aria-pressed={standingShown}
                    onClick={() => setStandingShown((shown) => !shown)}
                  >
                    {WORDS.standing}
                  </HudButton>
                </span>
              )}
            </div>
            <GloryBoard rosters={props.rosters} tab={tab} own={props.own} names={props.names} />
          </section>
          {standing && (
            <Standing standing={standing} invite={props.invite} goToDeep={props.goToDeep} stages={props.stages} />
          )}
        </div>
        {standing && standing.gloryRank !== null && (
          <PhoneFoot standing={standing} rank={standing.gloryRank} goToDeep={props.goToDeep} />
        )}
      </div>
    </HudPage>
  );
};

const AspectStrip = ({
  race,
  finishHeight,
  stages,
  phone,
}: {
  race: readonly SeasonAspect[];
  finishHeight: number;
  stages: number;
  phone: boolean;
}) => (
  <ol className="season-board__aspects">
    {race.map((aspect) => (
      <li
        key={aspect.aspectId}
        className="season-aspect"
        data-own={aspect.own || undefined}
        data-height={aspect.height}
        style={aspectVariables(aspect.aspectId) as CSSProperties}
      >
        <span className="season-aspect__head">
          <span className="season-aspect__rank">{WORDS.place(aspect.rank)}</span>
          <AspectMark aspect={aspect.aspectId} size={20} decorative />
          <span className="season-aspect__name">{aspectName(aspect.aspectId)}</span>
          <span className="season-aspect__height">
            <b>{formatExact(aspect.height)}</b>/{formatShort(finishHeight)}
          </span>
        </span>
        <span className="season-aspect__stages" aria-label={ASPECT_PAGE_WORDS.stage(aspect.stage, stages)}>
          {Array.from({ length: stages }, (_, index) => (
            <i
              key={index}
              data-done={index < aspect.stage - 1 || undefined}
              data-now={index === aspect.stage - 1 || undefined}
            />
          ))}
        </span>
        <span className="season-aspect__foot">
          <span className="season-aspect__pool" aria-label={WORDS.pool(aspect.pool)}>
            <Icon name="lords" size={16} />
            {phone ? formatShort(aspect.pool) : WORDS.pool(aspect.pool)}
          </span>
          <span className="season-aspect__members">
            <Icon name="people" size={16} />
            {formatExact(aspect.members)}
          </span>
        </span>
      </li>
    ))}
  </ol>
);

const GloryBoard = ({
  rosters,
  tab,
  own,
  names,
}: {
  rosters: readonly { aspect: AspectId; roster: GloryRoster }[];
  tab: AspectId | 0;
  own: OwnGloryRow | null;
  names: GloryNames;
}) => {
  const shown = tab === 0 ? rosters : rosters.filter((entry) => entry.aspect === tab);
  if (tab !== 0 && shown.every(({ roster }) => roster.total === 0))
    return <span className="season-board__empty">{SEASON_WORDS.aspectRosterEmpty(aspectName(tab))}</span>;
  const unnamed = unnamedMembers(shown);
  const rows = boardRows(rosters, tab, own);
  return (
    <div className="season-board__rows" role="table" aria-label={SEASON_WORDS.gloryLeaderboard}>
      <HudTableHead cols={COLS} colsWide={COLS_WIDE}>
        <span className="text-center">{RANK}</span>
        <span className="col-span-2">{WORDS.player}</span>
        <span className="season-row__order">{WORDS.order}</span>
        <span className="text-right">{ASPECT_PAGE_WORDS.glory}</span>
      </HudTableHead>
      {rows.map((row) => (
        <GloryTableRow key={row.key} row={row} />
      ))}
      {unnamed > 0 && names === "loading" && <HudSkeleton rows={Math.min(unnamed, 3)} />}
      {unnamed > 0 && typeof names === "object" && (
        <div role="alert">
          <HudEmpty
            icon="victory"
            line={SEASON_ERROR}
            action={
              <HudButton kind="secondary" onClick={names.retry}>
                {TRY_AGAIN}
              </HudButton>
            }
          />
        </div>
      )}
    </div>
  );
};

const GloryTableRow = ({ row }: { row: GloryRow }) => (
  <HudTableRow cols={COLS} colsWide={COLS_WIDE} label={`${row.rank}`} own={row.own}>
    <span className="flex justify-center">
      <HudPlaceMedal place={row.rank} size={24} below={row.rank} />
    </span>
    {row.aspect !== undefined ? <AspectMark aspect={row.aspect} size={20} decorative /> : <span />}
    <span className="min-w-0">
      <LordName account={row.owner} you={row.own} />
    </span>
    <span className="season-row__order">
      {row.order && (
        <>
          <OrderEmblem order={row.order.orderId} size={15} />
          <span className="truncate">{row.order.orderName}</span>
        </>
      )}
    </span>
    <span className="season-row__glory">
      <Icon name="victory" size={16} />
      {row.glory}
      <span className="sr-only">{` ${ASPECT_PAGE_WORDS.glory}`}</span>
    </span>
  </HudTableRow>
);

const Standing = ({
  standing,
  invite,
  goToDeep,
  stages,
}: {
  standing: SeasonStanding;
  invite?: ReactNode;
  goToDeep?: SeasonLeaderboardProps["goToDeep"];
  stages: number;
}) => (
  <aside
    data-season-standing
    data-glory={standing.glory}
    className="season-standing"
    aria-label={SEASON_WORDS.yourStanding}
    style={aspectVariables(standing.aspectId) as CSSProperties}
  >
    <span className="season-standing__label">{SEASON_WORDS.yourStanding}</span>
    <span className="season-standing__who">
      <AspectMark aspect={standing.aspectId} size={36} decorative />
      <span className="flex min-w-0 flex-col">
        <b className="season-standing__realm">{standing.realm}</b>
        <span className="season-standing__aspect">
          {WORDS.aspectPlace(aspectName(standing.aspectId), standing.aspectRank)}
          {standing.order && (
            <span className="inline-flex items-center gap-1">
              <OrderEmblem order={standing.order.orderId} size={14} />
              {standing.order.orderName}
            </span>
          )}
        </span>
      </span>
    </span>
    <span className="season-standing__tiles">
      <span className="season-standing__tile">
        <b>
          <Icon name="crown" size={18} />
          {formatExact(standing.glory)}
        </b>
        {standing.gloryRank !== null && <span>{WORDS.yourGlory(standing.gloryRank)}</span>}
        <span data-tone={standing.shares ? "good" : undefined}>{WORDS.qualifies}</span>
      </span>
      <span className="season-standing__tile">
        <b>
          <Icon name="lords" size={18} />
          {formatShort(standing.pool)}
        </b>
        <span>{WORDS.aspectPool(aspectName(standing.aspectId))}</span>
        <span data-tone="good">{WORDS.yourShare(standing.share)}</span>
      </span>
    </span>
    <span className="season-standing__label">{WORDS.triumphs(standing.stage, stages)}</span>
    <span className="season-standing__triumphs">
      {standing.triumphs.map(({ stage, day }) => (
        <span key={stage} className="season-triumph" data-won={day !== null || undefined}>
          <Icon name={TRIUMPH_ICONS[stage]} size={18} />
          {ASPECT_PAGE_WORDS.triumph[stage]}
        </span>
      ))}
    </span>
    {standing.altar && (
      <span className="season-standing__altar" data-charge={standing.altar.charge}>
        <span className="season-standing__altar-line">
          <span>{WORDS.altar}</span>
          <b>{WORDS.altarCharge(standing.altar.charge, standing.altar.threshold)}</b>
        </span>
        <HudMeter label={WORDS.altar} share={standing.altar.charge / standing.altar.threshold} />
      </span>
    )}
    <span className="season-standing__actions">
      {goToDeep && <GoToDeep goToDeep={goToDeep} />}
      {invite}
    </span>
  </aside>
);

const GoToDeep = ({
  goToDeep,
  short = false,
}: {
  goToDeep: NonNullable<SeasonLeaderboardProps["goToDeep"]>;
  short?: boolean;
}) =>
  "go" in goToDeep ? (
    <HudButton kind="primary" icon="spire" onClick={goToDeep.go}>
      {short ? WORDS.deep : ASPECT_PAGE_WORDS.goToDeep}
    </HudButton>
  ) : (
    <RefusedVerb word={short ? WORDS.deep : ASPECT_PAGE_WORDS.goToDeep} icon="spire" refusal={goToDeep.refused} />
  );

const PhoneFoot = ({
  standing,
  rank,
  goToDeep,
}: {
  standing: SeasonStanding;
  rank: number;
  goToDeep?: SeasonLeaderboardProps["goToDeep"];
}) => (
  <div className="season-board__phone-foot">
    <AspectMark aspect={standing.aspectId} size={22} decorative />
    <span className="flex min-w-0 flex-1 flex-col">
      <b className="truncate">{WORDS.footer(rank, standing.realm, standing.glory)}</b>
      <span className="truncate">{WORDS.footerPool(standing.pool, standing.share)}</span>
    </span>
    {goToDeep && <GoToDeep goToDeep={goToDeep} short />}
  </div>
);
