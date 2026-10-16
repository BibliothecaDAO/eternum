import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { Button } from "@/ui/design-system/kit/button";
import { useEmpireSuggestions } from "@/ui/features/world/containers/left-facets/use-empire-suggestions";
import {
  isOrderSuggestion,
  useSuggestionActions,
} from "@/ui/features/world/containers/left-facets/use-suggestion-actions";
import { type RealmLevelUp, useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { configManager, Position, structureMapPosition } from "@bibliothecadao/eternum";
import type { ID, Structure } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";
import { resolveStructureAttention } from "@/ui/features/world/containers/top-header/attention-policy";
import { useNextUpShows } from "./next-up-shows";

/** Tells the screen whether Next up shows a step, and that it shows none once it unmounts. */
const usePublishShown = (step: NextStep | undefined) => {
  const showing = step !== undefined;
  useEffect(() => {
    useNextUpShows.setState({ showing });
  }, [showing]);
  useEffect(() => {
    return () => useNextUpShows.setState({ showing: false, act: null });
  }, []);
};

/** A realm's level-up, read and sent by the realm's own hook; or any other step, with its line and its one verb. */
type NextStep =
  | { key: string; kind: "level-up"; realmId: ID; name: string }
  | { key: string; kind: "order"; line: string; verb: string; busy: boolean; run: () => void };

/**
 * The one thing to do next, with the others a tap away: the selected realm's level-up step when it can be taken (or
 * is in flight), then the structures under attack or with arrivals, then the suggested moves, where another realm's
 * level-up is that realm's own step. Its button is the screen's one primary action.
 */
export const NextUp = () => {
  const steps = useNextSteps();
  const [cursor, setCursor] = useState(0);
  const index = steps.length === 0 ? 0 : cursor % steps.length;
  const step = steps[index] as NextStep | undefined;
  usePublishShown(step);
  if (!step) return null;
  return (
    <section
      aria-label="Next up"
      className={cn(OVERLAY_SURFACE_BASE, "pointer-events-auto flex flex-col gap-2 rounded-xl p-3")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="hud-panel-title flex items-center gap-2">
          Next up
          <kbd className="hud-key" title="Space does it">
            Space
          </kbd>
        </h2>
        {steps.length > 1 && (
          <button
            type="button"
            onClick={() => setCursor(index + 1)}
            className="h-9 rounded-md px-2 text-sm font-semibold text-kit-cream hover:text-gold"
          >
            {index + 1} of {steps.length} ›
          </button>
        )}
      </div>
      {step.kind === "level-up" ? (
        <LevelUpStep key={step.key} realmId={step.realmId} name={step.name} />
      ) : (
        <StepBody line={step.line} verb={step.verb} busy={step.busy} run={step.run} />
      )}
    </section>
  );
};

const StepBody = ({
  line,
  verb,
  busy,
  disabled = false,
  run,
}: {
  line: string;
  verb: string;
  busy: boolean;
  disabled?: boolean;
  run: () => void;
}) => {
  usePublishAct(busy || disabled ? null : run);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base text-kit-cream">{line}</p>
      <Button
        role="primary"
        word={verb}
        loading={busy ? "Sending…" : undefined}
        disabled={disabled}
        onClick={run}
        className="w-full"
      />
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

/** A realm's level-up step as its hook reads it, whichever realm it is: the same readiness, send and lock as its card. */
const LevelUpStep = ({ realmId, name }: { realmId: ID; name: string }) => {
  const levelUp = useRealmLevelUp(realmId);
  if (!levelUp) return null;
  return (
    <StepBody
      line={levelUpLine(levelUp, name)}
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
  const suggestions = useSuggestionSteps(structureEntityId);
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
  return [...levelUpStep, ...attention, ...suggestions];
}

/** Structures under attack or with arrivals waiting, each as a step that shows it. */
function useAttentionSteps(): NextStep[] {
  const { setup } = useGame();
  const mode = useGameModeConfig();
  const goToStructure = useGoToStructure(setup);
  const structures = useFactView(playerStructuresView);
  const arrivedIds = useUIStore((state) => state.arrivedArrivalStructureIds);
  const now = Math.floor(useNowMs() / 1000);
  const revision = useNativeRevision(["Guard"]);
  const { attackedIds, targets } = useMemo(
    () =>
      resolveStructureAttention(structures, arrivedIds, now, [
        ...setup.store.inGame("Guard", configManager.getActiveGameId()),
      ]),
    [structures, arrivedIds, now, setup.store, revision],
  );
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
