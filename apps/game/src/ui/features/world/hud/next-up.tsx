import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Button } from "@/ui/design-system/kit/button";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { useEmpireSuggestions } from "@/ui/features/world/containers/left-facets/use-empire-suggestions";
import {
  isOrderSuggestion,
  useSuggestionActions,
} from "@/ui/features/world/containers/left-facets/use-suggestion-actions";
import { type RealmLevelUp, useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { canIssueOrders, useActNowRefusal } from "@/utils/can-issue-orders";
import { Position, structureMapPosition } from "@bibliothecadao/eternum";
import type { ID, Structure } from "@bibliothecadao/types";
import { useEffect, useState } from "react";
import { useStructureAttention } from "@/ui/features/world/containers/top-header/use-structure-attention";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { useNextUpShows } from "./next-up-shows";
import type { NextStep } from "./next-step";
import { useCoachSteps, useLostArmyAlert } from "./use-coach-steps";

/** Tells the screen whether Next up shows a step with its button, and that it shows none once it unmounts. */
const usePublishShown = (step: NextStep | undefined) => {
  const showing = step !== undefined && (step.kind === "level-up" || (step.verb !== null && step.run !== null));
  useEffect(() => {
    useNextUpShows.setState({ showing });
  }, [showing]);
  useEffect(() => {
    return () => useNextUpShows.setState({ showing: false, act: null });
  }, []);
};

/**
 * The one thing to do now: the step that scores most for the player's state, with the others a tap away. First the
 * alerts: structures under attack or with arrivals, and an army just lost. Then, as tips, the coach's steps ranked by
 * what scores (raise an army where troops are on hand, open a crate beside an army, explore, go for a crate, a camp or
 * rift, a Hyperstructure, or level up first where the army would surely lose), then the selected realm's level-up and
 * the suggested moves. Tips off (Settings) leaves the alerts alone. Its button is the screen's one primary action;
 * before play opens it waits, saying when play starts.
 */
export const NextUp = () => <NextUpView steps={useNextSteps()} refusal={useActNowRefusal()} />;

/**
 * Next up as it draws its steps: the current one (the first), or one the player pages to. Paging is a look, not a
 * choice: once the current step changes, Next up is back on it.
 */
export const NextUpView = ({ steps, refusal = null }: { steps: NextStep[]; refusal?: string | null }) => {
  const [paged, setPaged] = useState<{ from: string; to: string } | null>(null);
  const current = steps[0] as NextStep | undefined;
  const step = (paged && current?.key === paged.from && steps.find(({ key }) => key === paged.to)) || current;
  usePublishShown(step);
  if (!step || !current) return null;
  const index = steps.indexOf(step);
  const pageOn = () => {
    const next = steps[(index + 1) % steps.length];
    setPaged(next === current ? null : { from: current.key, to: next.key });
  };
  return (
    <InfoBubble
      label="Next up"
      title="Next up"
      cue={
        steps.length > 1 && (
          <button
            type="button"
            onClick={pageOn}
            className="rounded-md px-1 font-semibold text-kit-cream hover:text-gold"
          >
            {index + 1} of {steps.length} ›
          </button>
        )
      }
    >
      {step.kind === "level-up" ? (
        <LevelUpStep key={step.key} realmId={step.realmId} name={step.name} why={step.why} />
      ) : (
        <StepBody line={step.line} verb={step.verb} busy={step.busy} refusal={refusal} run={step.run} />
      )}
    </InfoBubble>
  );
};

/** A step's line and its one button; a step taken on the map has no button, and before play the button waits. */
const StepBody = ({
  line,
  verb,
  busy,
  disabled = false,
  refusal = null,
  run,
}: {
  line: string;
  verb: string | null;
  busy: boolean;
  disabled?: boolean;
  refusal?: string | null;
  run: (() => void) | null;
}) => {
  const ready = verb !== null && run !== null && !busy && !disabled && refusal === null;
  usePublishAct(ready ? run : null);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-kit-cream">{line}</p>
      {verb !== null && run !== null && (
        <Button
          role="primary"
          word={verb}
          loading={busy ? "Sending…" : undefined}
          disabled={disabled || refusal !== null}
          onClick={run}
          className="!h-10 w-full"
        />
      )}
      {verb !== null && refusal !== null && <p className="text-xs text-kit-cream/70">{refusal}</p>}
    </div>
  );
};

/** Hands `Space` the shown step's action while it can be taken, and takes it back when the step changes or goes. */
const usePublishAct = (act: (() => void) | null) => {
  useEffect(() => {
    useNextUpShows.setState({ act });
    return () => useNextUpShows.setState({ act: null });
  }, [act]);
};

/**
 * A realm's level-up step as its hook reads it, whichever realm it is: the same readiness, send and lock as its card,
 * after the reason the step asks for it when it has one.
 */
const LevelUpStep = ({ realmId, name, why }: { realmId: ID; name: string; why?: string }) => {
  const levelUp = useRealmLevelUp(realmId);
  if (!levelUp) return null;
  const state = levelUpLine(levelUp, name);
  return (
    <StepBody
      line={why ? `${why} ${state}` : state}
      verb={levelUp.word}
      busy={levelUp.loading}
      disabled={!levelUp.ready}
      run={levelUp.run}
    />
  );
};

const levelUpLine = (levelUp: RealmLevelUp, name: string): string => {
  if (levelUp.loading) return `${name}: sent, waiting for the game.`;
  if (levelUp.refusal) return `${name}: ${levelUp.refusal.toLowerCase()}.`;
  if (levelUp.mode === "max") return `${name} is fully upgraded.`;
  return levelUp.mode === "provision" ? `${name} is ready to be provisioned.` : `${name} can level up.`;
};

function useNextSteps(): NextStep[] {
  const ordersAllowed = useUIStore(canIssueOrders);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const levelUp = useRealmLevelUp(structureEntityId);
  const attention = useAttentionSteps();
  const lostArmy = useLostArmyAlert();
  const coach = useCoachSteps();
  const suggestions = useSuggestionSteps(structureEntityId);
  const tips = useWorldAppearanceStore((state) => state.nextUpTips);
  const structures = useFactView(playerStructuresView);
  const mode = useGameModeConfig();
  if (!ordersAllowed) return [];

  const selected = structures.find((structure) => structure.entityId === structureEntityId);
  const offersLevelUp = selected && levelUp && (levelUp.ready || levelUp.loading);
  const levelUpStep: NextStep[] = offersLevelUp
    ? [
        {
          key: `level-up:${selected.entityId}`,
          kind: "level-up",
          realmId: selected.entityId,
          name: mode.structure.getName(selected.structure).name,
        },
      ]
    : [];
  const alerts = [...attention, ...lostArmy];
  // A lost army's alert already says where to raise the next one.
  const route = lostArmy.length > 0 ? coach.filter(({ key }) => !RAISE_KEYS.has(key)) : coach;
  // With tips off (Settings), Next up holds the alerts alone, and shows nothing without one.
  return tips ? [...alerts, ...route, ...levelUpStep, ...suggestions] : alerts;
}

/** The coach's steps for an empty field: raising an army, or the barracks it needs first. */
const RAISE_KEYS = new Set(["coach:raise", "coach:barracks"]);

/** Structures under attack or with arrivals waiting, each as a step that shows it. */
function useAttentionSteps(): NextStep[] {
  const { setup } = useGame();
  const mode = useGameModeConfig();
  const goToStructure = useGoToStructure(setup);
  const { attackedIds, targets } = useStructureAttention();
  // Those under attack first, then those with arrivals.
  const attention = [
    ...targets
      .filter(({ entityId }) => attackedIds.has(entityId))
      .map((structure) => ({ structure, reason: "attacked" })),
    ...targets
      .filter(({ entityId }) => !attackedIds.has(entityId))
      .map((structure) => ({ structure, reason: "arrived" })),
  ];

  const show = (structure: Structure) => {
    const position = structureMapPosition(setup.store, structure.structure);
    if (position) void goToStructure(structure.entityId, Position.fromContract(position), true);
  };
  return attention.map(({ structure, reason }) => {
    const name = mode.structure.getName(structure.structure).name;
    return {
      key: `${reason}:${structure.entityId}`,
      kind: "order",
      line: reason === "attacked" ? `${name} is under attack.` : `Resources arrived at ${name}.`,
      verb: `Show ${name}`,
      busy: false,
      run: () => show(structure),
    };
  });
}

/**
 * The suggested moves. A realm's level-up is that realm's own step, read and sent by its hook; the selected realm's
 * leads the list on its own, so it is not repeated here.
 */
function useSuggestionSteps(selectedId: number): NextStep[] {
  const suggestions = useEmpireSuggestions();
  const { handleSuggestionClick, pendingSuggestionIds } = useSuggestionActions();
  // Each suggestion's own flow words its failure.
  const run = (suggestion: Parameters<typeof handleSuggestionClick>[0]) =>
    void handleSuggestionClick(suggestion).catch(() => undefined);
  return suggestions.flatMap((suggestion): NextStep[] => {
    if (isOrderSuggestion(suggestion)) {
      return [
        {
          key: `suggestion:${suggestion.id}`,
          kind: "order",
          line: `${suggestion.realmName}: ${suggestion.reason ?? suggestion.label}`,
          verb: suggestion.label,
          busy: pendingSuggestionIds.includes(suggestion.id),
          run: () => run(suggestion),
        },
      ];
    }
    if (suggestion.realmId === selectedId) return [];
    return [
      {
        key: `level-up:${suggestion.realmId}`,
        kind: "level-up",
        realmId: suggestion.realmId,
        name: suggestion.realmName,
      },
    ];
  });
}
