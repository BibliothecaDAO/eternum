import { useState } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { configManager, structureMapPosition, Position } from "@bibliothecadao/eternum";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { resolveStructureAttention } from "../top-header/attention-policy";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders, useActNowRefusal } from "@/utils/can-issue-orders";
import { Button } from "@/ui/design-system/kit/button";
import { useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { HudPanel } from "../arena-hud-view";
import { useEmpireSuggestions, type EmpireSuggestion } from "./use-empire-suggestions";
import { isOrderSuggestion, useSuggestionActions } from "./use-suggestion-actions";

export function NextSuggestionView({
  title,
  label,
  onClick,
  disabled = false,
  reason,
}: {
  title: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  reason?: string | null;
}) {
  return (
    <HudPanel title={title} className="suggestion-panel">
      <div data-notice className="primary-suggestion" title={reason ?? undefined}>
        <Button role="primary" word={label} onClick={onClick} disabled={disabled} />
      </div>
    </HudPanel>
  );
}
export function NextSuggestion() {
  const suggestions = useEmpireSuggestions();
  const allowed = useUIStore(canIssueOrders);
  const { setup } = useGame();
  const structures = useFactView(playerStructuresView);
  const arrived = useUIStore((state) => state.arrivedArrivalStructureIds);
  const now = useCurrentDefaultTick();
  useNativeRevision(["Guard"]);
  const { targets } = resolveStructureAttention(structures, arrived, now, [
    ...setup.store.inGame("Guard", configManager.getActiveGameId()),
  ]);
  const [attentionIndex, setAttentionIndex] = useState(0);
  const goToStructure = useGoToStructure(setup);
  const mode = useGameModeConfig();
  if (!allowed) return null;
  const target = targets[attentionIndex % targets.length];
  if (target)
    return (
      <NextSuggestionView
        title={`${mode.structure.getName(target.structure).name} needs attention`}
        label="Review realm"
        onClick={() => {
          const position = structureMapPosition(setup.store, target.structure);
          if (position) void goToStructure(target.entityId, Position.fromContract(position), true);
          setAttentionIndex((index) => index + 1);
        }}
      />
    );
  return suggestions[0] ? <SuggestedOrder suggestion={suggestions[0]} /> : null;
}
function SuggestedOrder({ suggestion }: { suggestion: EmpireSuggestion }) {
  const { handleSuggestionClick, pendingSuggestionIds } = useSuggestionActions();
  const refusal = useActNowRefusal();
  const upgrade = useRealmLevelUp(suggestion.realmId);
  const order = isOrderSuggestion(suggestion);
  const reason = order ? refusal : upgrade?.refusal;
  return (
    <NextSuggestionView
      title={suggestion.realmName}
      label={suggestion.label}
      reason={reason}
      disabled={order ? !!refusal || pendingSuggestionIds.includes(suggestion.id) : !upgrade?.ready || upgrade.loading}
      onClick={() => {
        if (order) void handleSuggestionClick(suggestion);
        else void upgrade?.run();
      }}
    />
  );
}
