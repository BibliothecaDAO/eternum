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
import {
  type EmpireSuggestion,
  useEmpireSuggestions,
} from "@/ui/features/world/containers/left-facets/use-empire-suggestions";
import { useSuggestionActions } from "@/ui/features/world/containers/left-facets/use-suggestion-actions";
import { type RealmLevelUp, useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { configManager, Position, structureMapPosition } from "@bibliothecadao/eternum";
import type { Structure } from "@bibliothecadao/types";
import { useMemo, useState } from "react";
import { resolveStructureAttention } from "./attention-policy";

type NextStep = { key: string; line: string; verb: string; busy: boolean; run: () => void };

/**
 * The one thing to do next, with the others a tap away: the selected realm's level-up step when it can be taken,
 * then the structures under attack or with arrivals, then the suggested moves. Its button is the screen's one
 * primary action.
 */
export const NextUp = ({ compact = false }: { compact?: boolean }) => {
  const steps = useNextSteps();
  const [cursor, setCursor] = useState(0);
  if (steps.length === 0) return null;
  const index = cursor % steps.length;
  const step = steps[index];
  return (
    <section
      aria-label="Next up"
      className={cn(OVERLAY_SURFACE_BASE, "pointer-events-auto flex flex-col gap-2 rounded-xl p-3")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-kit-muted">Next up</h2>
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
      <div className={cn("flex gap-2", compact ? "items-center" : "flex-col")}>
        <p className={cn("text-base text-kit-cream", compact && "min-w-0 flex-1")}>{step.line}</p>
        <Button
          role="primary"
          word={step.verb}
          loading={step.busy ? "Sending…" : undefined}
          onClick={step.run}
          className={compact ? "shrink-0" : "w-full"}
        />
      </div>
    </section>
  );
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
  const levelUpStep =
    selected && levelUp?.ready ? [toLevelUpStep(levelUp, mode.structure.getName(selected.structure).name)] : [];
  return [...levelUpStep, ...attention, ...suggestions];
}

const toLevelUpStep = (levelUp: RealmLevelUp, name: string): NextStep => ({
  key: `level-up:${levelUp.mode}`,
  line: levelUp.mode === "provision" ? `${name} is ready to be provisioned.` : `${name} can level up.`,
  verb: levelUp.word,
  busy: levelUp.loading,
  run: levelUp.run,
});

/** Structures under attack or with arrivals waiting, each as a step that shows it. */
function useAttentionSteps(): NextStep[] {
  const { setup } = useGame();
  const mode = useGameModeConfig();
  const goToStructure = useGoToStructure(setup);
  const structures = useFactView(playerStructuresView);
  const arrivedIds = useUIStore((state) => state.arrivedArrivalStructureIds);
  const now = Math.floor(useNowMs() / 1000);
  const revision = useNativeRevision(["Guard"]);
  const attention = useMemo(
    () =>
      resolveStructureAttention(structures, arrivedIds, now, [
        ...setup.store.inGame("Guard", configManager.getActiveGameId()),
      ]),
    [structures, arrivedIds, now, setup.store, revision],
  );

  const show = (structure: Structure) => {
    const position = structureMapPosition(setup.store, structure.structure);
    if (position) void goToStructure(structure.entityId, Position.fromContract(position), true);
  };
  return attention.map(({ structure, reason }) => {
    const name = mode.structure.getName(structure.structure).name;
    return {
      key: `${reason}:${structure.entityId}`,
      line: reason === "attacked" ? `${name} is under attack.` : `Resources arrived at ${name}.`,
      verb: `Show ${name}`,
      busy: false,
      run: () => show(structure),
    };
  });
}

/** The suggested moves, less the selected realm's level-up, which leads the list as its own step. */
function useSuggestionSteps(selectedId: number): NextStep[] {
  const suggestions = useEmpireSuggestions();
  const { handleSuggestionClick, pendingRealmId, pendingSuggestionIds } = useSuggestionActions();
  // Each suggestion's own flow words its failure.
  const run = (suggestion: EmpireSuggestion) => void handleSuggestionClick(suggestion).catch(() => undefined);
  return suggestions
    .filter((suggestion) => !(suggestion.action === "upgrade" && suggestion.realmId === selectedId))
    .map((suggestion) => ({
      key: `suggestion:${suggestion.id}`,
      line: `${suggestion.realmName}: ${suggestion.reason ?? suggestion.label}`,
      verb: suggestion.label,
      busy: pendingSuggestionIds.includes(suggestion.id) || pendingRealmId === suggestion.realmId,
      run: () => run(suggestion),
    }));
}
