import "./army-relic-slots.css";

import { configManager, type RelicCollectOutcome } from "@bibliothecadao/eternum";
import { nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import { formatDuration, formatShortDuration, tierNumeral } from "@bibliothecadao/types";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Account } from "starknet";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useStreamedStoryEvents } from "@/hooks/store/use-story-events-store";
import { RELIC_KINDS, relicMeaning, type RelicKind } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudTier } from "@/ui/design-system/kit/hud-elements";
import { type Rank, RELIC_WORDS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";

import { usePartShown } from "../opening/opening-context";
import { usePickEffectBase } from "../pick-effect-text";
import { ARMY_RELIC_MODELS, hasArmyRelics, readArmyRelics, type ArmyRelicSlot } from "./army-relics";
import { relicCompactStat, relicEffect, relicName, relicSeconds } from "./relic-catalog";

interface RelicCollectionMoment {
  id: string;
  kind: RelicKind;
  foundRank: number;
  previousRank: number;
  resultRank: number;
  outcome: RelicCollectOutcome;
}

const RANKS: readonly Rank[] = Array.from(
  { length: nativeRuleConstants.ATTRIBUTE_CAP },
  (_, index) => (index + 1) as Rank,
);
const MERGE_BEAT_2_MS = 350;
const MERGE_BEAT_3_MS = 800;
const MOMENT_DURATION_MS = 4_500;

export const ArmyRelicSlots = ({ explorerId }: { explorerId: number }) => {
  const { setup, account } = useGame();
  const now = useCurrentBlockTimestamp();
  useNativeRevision(ARMY_RELIC_MODELS);
  const shown = usePartShown("relic-slots");
  const pickBase = usePickEffectBase(explorerId)();
  const switching = useInFlight("army", explorerId) !== undefined;
  const gameId = configManager.getActiveGameId();
  const relics = readArmyRelics(setup.store, gameId, explorerId, now);
  const rules = setup.store.get("SliceRules", { game_id: gameId });
  const moment = useRecentRelicCollection(explorerId);
  const mergeBeat = useMergeBeat(moment);
  const [selectedKind, setSelectedKind] = useState<RelicKind | null>(null);
  const [pressingKind, setPressingKind] = useState<RelicKind | null>(null);
  const [ladderOpen, setLadderOpen] = useState(false);

  useEffect(() => {
    if (moment) setSelectedKind(moment.kind);
  }, [moment]);

  if (!shown || !hasArmyRelics(relics)) return null;

  const fallbackKind =
    relics.byKind.find((slot) => slot.carriedRank > 0)?.kind ??
    relics.byKind.find((slot) => slot.active !== null)?.kind ??
    RELIC_KINDS[0]!;
  const activeKind = selectedKind ?? fallbackKind;
  const selected = relics.byKind.find((slot) => slot.kind === activeKind) ?? relics.byKind[0]!;

  const activate = (kind: RelicKind, rank: number) => {
    setPressingKind(kind);
    return sendOnce("army", explorerId, { order: "use" }, () =>
      setup.systemCalls.apply_relic({
        signer: account.account as unknown as Account,
        entity_id: explorerId,
        kind,
        expected_rank: rank,
      }),
    ).catch((error: unknown) => toast.failed(error, "Could not use the relic."));
  };

  return (
    <section className="relic-dock" aria-label={RELIC_WORDS.title} data-army-relics>
      <div className="relic-dock__head">
        <span className="relic-dock__title">{RELIC_WORDS.title}</span>
        <span className="relic-dock__summary" data-relics-summary>
          {RELIC_WORDS.activeCount(relics.running.length, RELIC_KINDS.length)}
        </span>
      </div>
      <div className="relic-dock__grid" role="tablist" aria-label={RELIC_WORDS.title}>
        {relics.byKind.map((slot) => (
          <RelicSlotButton
            key={slot.kind}
            slot={slot}
            selected={slot.kind === selected.kind}
            mergeBeat={moment?.kind === slot.kind && moment.outcome === "Merged" ? mergeBeat : null}
            onSelect={() => {
              setSelectedKind(slot.kind);
              setLadderOpen(false);
            }}
          />
        ))}
      </div>
      {moment && (
        <RelicCollectMoment
          moment={moment}
          mergeBeat={mergeBeat}
          canActivate={relics.byKind.some(
            (slot) => slot.kind === moment.kind && slot.carriedRank === moment.resultRank,
          )}
          switching={switching}
          onActivate={() => activate(moment.kind, moment.resultRank)}
        />
      )}
      <RelicActionTray
        slot={selected}
        pickBase={pickBase}
        secondsPerRank={rules?.relic_seconds_per_rank}
        switching={switching}
        pressing={switching && pressingKind === selected.kind}
        ladderOpen={ladderOpen}
        onToggleLadder={() => setLadderOpen((open) => !open)}
        onCloseLadder={() => setLadderOpen(false)}
        onActivate={() => activate(selected.kind, selected.carriedRank)}
      />
    </section>
  );
};

const RelicSlotButton = ({
  slot,
  selected,
  mergeBeat,
  onSelect,
}: {
  slot: ArmyRelicSlot;
  selected: boolean;
  mergeBeat: 1 | 2 | 3 | null;
  onSelect: () => void;
}) => {
  const displayRank = slot.carriedRank || slot.active?.rank || 0;
  const empty = displayRank === 0;
  const kindLabel = RELIC_WORDS.kinds[slot.kind];
  const label =
    displayRank > 0 ? relicName({ kind: slot.kind, rank: displayRank }) : `${kindLabel} · ${RELIC_WORDS.empty}`;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={label}
      data-relic-slot={slot.kind}
      data-empty={empty ? "true" : undefined}
      data-active={slot.active ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      data-merge-beat={mergeBeat ?? undefined}
      className="ui-tab relic-slot"
      onClick={onSelect}
    >
      {mergeBeat === 2 && <span className="relic-slot__burst" aria-hidden="true" />}
      <span className="relic-slot__art">
        <Icon name={relicMeaning(slot.kind)} size={24} />
      </span>
      {displayRank > 0 && (
        <span className="relic-slot__tier">
          <HudTier tier={displayRank as Rank} size="line" />
        </span>
      )}
      <span className="relic-slot__name">{kindLabel}</span>
      {slot.active && (
        <span className="relic-slot__timer" data-relic-running={slot.kind}>
          {formatShortDuration(slot.active.secondsLeft)}
        </span>
      )}
    </button>
  );
};

const RelicActionTray = ({
  slot,
  pickBase,
  secondsPerRank,
  switching,
  pressing,
  ladderOpen,
  onToggleLadder,
  onCloseLadder,
  onActivate,
}: {
  slot: ArmyRelicSlot;
  pickBase: ReturnType<ReturnType<typeof usePickEffectBase>>;
  secondsPerRank: number | undefined;
  switching: boolean;
  pressing: boolean;
  ladderOpen: boolean;
  onToggleLadder: () => void;
  onCloseLadder: () => void;
  onActivate: () => void;
}) => {
  const displayRank = slot.carriedRank || slot.active?.rank || 0;
  const kindLabel = RELIC_WORDS.kinds[slot.kind];
  const title = displayRank > 0 ? relicName({ kind: slot.kind, rank: displayRank }) : kindLabel;
  const duration =
    slot.carriedRank > 0 && secondsPerRank !== undefined
      ? formatDuration(
          relicSeconds({ kind: slot.kind, rank: slot.carriedRank }, { relic_seconds_per_rank: secondsPerRank }),
          {
            days: false,
          },
        )
      : undefined;
  const detail =
    displayRank === 0
      ? RELIC_WORDS.mergeHint
      : slot.carriedRank > 0
        ? [
            relicEffect({ kind: slot.kind, rank: slot.carriedRank }, pickBase),
            duration,
            slot.active ? RELIC_WORDS.replacesRunning : undefined,
          ]
            .filter(Boolean)
            .join(" · ")
        : `${relicEffect({ kind: slot.kind, rank: slot.active!.rank }, pickBase)} · ${RELIC_WORDS.timeLeft(
            formatDuration(slot.active!.secondsLeft, { days: false }),
          )}`;

  return (
    <div className="relic-tray" data-relic-tray={slot.kind}>
      <div className="relic-tray__main">
        <Icon name={relicMeaning(slot.kind)} size={22} />
        <div className="relic-tray__info">
          <div className="relic-tray__title">
            <span>{title}</span>
            {displayRank > 0 && <HudTier tier={displayRank as Rank} size="line" />}
          </div>
          <div className="relic-tray__detail">{detail}</div>
        </div>
        <div className="relic-tray__actions">
          <div className="relic-tray__ladder-wrap" onMouseLeave={onCloseLadder}>
            <button
              type="button"
              className="relic-tray__ladder-btn"
              aria-label={RELIC_WORDS.tierInfoLabel(kindLabel)}
              aria-expanded={ladderOpen}
              onMouseEnter={() => {
                if (!ladderOpen) onToggleLadder();
              }}
              onClick={onToggleLadder}
            >
              i
            </button>
            {ladderOpen && <RelicTierLadder kind={slot.kind} currentRank={displayRank} />}
          </div>
          {slot.carriedRank > 0 && (
            <HudButton
              kind="primary"
              size="sm"
              disabled={switching}
              aria-label={`${RELIC_WORDS.switchOn} ${relicName({ kind: slot.kind, rank: slot.carriedRank })}`}
              onClick={onActivate}
            >
              {pressing ? RELIC_WORDS.switching : RELIC_WORDS.switchOn}
            </HudButton>
          )}
        </div>
      </div>
    </div>
  );
};

const RelicTierLadder = ({ kind, currentRank }: { kind: RelicKind; currentRank: number }) => (
  <div className="relic-ladder" role="tooltip" data-relic-ladder={kind}>
    <span className="relic-ladder__title">{RELIC_WORDS.tierLadderTitle(RELIC_WORDS.kinds[kind])}</span>
    {RANKS.map((rank) => (
      <div key={rank} className="relic-ladder__row" data-current={rank === currentRank ? "true" : undefined}>
        <HudTier tier={rank} size="line" />
        <span>{relicCompactStat({ kind, rank })}</span>
      </div>
    ))}
    <p className="relic-ladder__hint">{RELIC_WORDS.mergeHint}</p>
  </div>
);

const RelicCollectMoment = ({
  moment,
  mergeBeat,
  canActivate,
  switching,
  onActivate,
}: {
  moment: RelicCollectionMoment;
  mergeBeat: 1 | 2 | 3 | null;
  canActivate: boolean;
  switching: boolean;
  onActivate: () => void;
}) => {
  if (moment.outcome === "Merged") {
    const from = tierNumeral(moment.previousRank as Rank);
    const to = tierNumeral(moment.resultRank as Rank);
    return (
      <div className="relic-moment" data-relic-collect-badge="Merged" data-merge-beat={mergeBeat ?? 3}>
        <div className="relic-moment__body">
          <div className="relic-moment__headline">
            <HudTier tier={(mergeBeat === 1 ? moment.previousRank : moment.resultRank) as Rank} size="line" />
            <span>{RELIC_WORDS.mergedCallout(from, to)}</span>
          </div>
          <span className="relic-moment__jump">
            {`${relicCompactStat({ kind: moment.kind, rank: moment.previousRank })} → ${relicCompactStat({
              kind: moment.kind,
              rank: moment.resultRank,
            })}`}
          </span>
        </div>
        {canActivate && (
          <HudButton kind="primary" size="sm" disabled={switching} onClick={onActivate}>
            {RELIC_WORDS.switchOn}
          </HudButton>
        )}
      </div>
    );
  }
  const badgeText =
    moment.outcome === "Collected"
      ? RELIC_WORDS.outcomeCollected
      : moment.outcome === "Replaced"
        ? RELIC_WORDS.outcomeReplaced(tierNumeral(moment.previousRank as Rank), tierNumeral(moment.resultRank as Rank))
        : RELIC_WORDS.outcomeDiscarded;
  return (
    <div className="relic-moment" data-relic-collect-badge={moment.outcome}>
      <span>{`${RELIC_WORDS.kinds[moment.kind]} · ${badgeText}`}</span>
    </div>
  );
};

const parseEnumVariant = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const [key] = Object.keys(value as Record<string, unknown>);
    return key ?? null;
  }
  return null;
};

const useRecentRelicCollection = (explorerId: number): RelicCollectionMoment | null => {
  const events = useStreamedStoryEvents("RelicCollected");
  const seenRef = useRef<Set<string> | null>(null);
  const [active, setActive] = useState<RelicCollectionMoment | null>(null);

  const matching = useMemo(
    () =>
      events.filter((event) => {
        const id = event.storyPayload.explorer_id;
        return id !== undefined && id !== null && Number(id) === explorerId;
      }),
    [events, explorerId],
  );

  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(matching.map((event) => event.event_id));
      return;
    }
    const fresh = matching.find((event) => !seenRef.current!.has(event.event_id));
    if (!fresh) return;
    seenRef.current.add(fresh.event_id);
    const kind = parseEnumVariant(fresh.storyPayload.kind) as RelicKind | null;
    const outcome = parseEnumVariant(fresh.storyPayload.outcome) as RelicCollectOutcome | null;
    if (!kind || !outcome || !RELIC_KINDS.includes(kind)) return;
    const next: RelicCollectionMoment = {
      id: fresh.event_id,
      kind,
      foundRank: Number(fresh.storyPayload.found_rank ?? 0),
      previousRank: Number(fresh.storyPayload.previous_rank ?? 0),
      resultRank: Number(fresh.storyPayload.result_rank ?? 0),
      outcome,
    };
    setActive(next);
  }, [matching]);

  useEffect(() => {
    if (!active) return;
    const clear = window.setTimeout(
      () => setActive((current) => (current?.id === active.id ? null : current)),
      MOMENT_DURATION_MS,
    );
    return () => window.clearTimeout(clear);
  }, [active]);

  return active;
};

const useMergeBeat = (moment: RelicCollectionMoment | null): 1 | 2 | 3 | null => {
  const [beat, setBeat] = useState<1 | 2 | 3 | null>(null);
  useEffect(() => {
    if (!moment || moment.outcome !== "Merged") {
      setBeat(null);
      return;
    }
    setBeat(1);
    const beat2 = window.setTimeout(() => setBeat(2), MERGE_BEAT_2_MS);
    const beat3 = window.setTimeout(() => setBeat(3), MERGE_BEAT_3_MS);
    return () => {
      window.clearTimeout(beat2);
      window.clearTimeout(beat3);
    };
  }, [moment]);
  return beat;
};
