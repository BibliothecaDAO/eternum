import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { structureMapPosition } from "@bibliothecadao/eternum";
import { formatCount } from "@bibliothecadao/types";
import { memo, useRef } from "react";
import { useGame } from "@/hooks/context/game-context";
import { Position } from "@bibliothecadao/eternum";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useBuildOrderFailure } from "@/hooks/use-build-orders";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { SuggestionsPanel } from "../left-facets/suggestions-panel";
import { useEmpireSuggestions } from "../left-facets/use-empire-suggestions";
import { HudButton, HudChip } from "@/ui/design-system/kit/hud-elements";
import { nextAttentionItem } from "./attention-policy";
import { useStructureAttention } from "./use-structure-attention";

export const AttentionPill = memo(() => {
  const ordersAllowed = useUIStore(canIssueOrders);
  return ordersAllowed ? <AttentionCycle /> : null;
});
AttentionPill.displayName = "AttentionPill";

function AttentionCycle() {
  const { setup } = useGame();
  const goToStructure = useGoToStructure(setup);
  const structures = useFactView(playerStructuresView);
  const suggestions = useEmpireSuggestions();
  const buildOrderFailure = useBuildOrderFailure();
  const previousKey = useRef<string | null>(null);
  const { targets } = useStructureAttention();
  const items = [
    ...targets.map((target) => ({
      key: `attention:${target.entityId}`,
      realmId: target.entityId,
      suggestionId: null as string | null,
    })),
    ...suggestions.map((suggestion) => ({
      key: `suggestion:${suggestion.id}`,
      realmId: suggestion.realmId as number | null,
      suggestionId: suggestion.id,
    })),
    // The account's orders failing to be read is said where the steps are, so it counts as one more to see.
    ...(buildOrderFailure ? [{ key: "build-orders", realmId: null, suggestionId: "build-orders" }] : []),
  ];
  const openSuggestions = (selectedId: string) =>
    usePopoverStore.getState().openSurface({
      id: "suggestions",
      content: <SuggestionsPanel selectedId={selectedId} />,
      anchor: "top-center",
      mapClick: "dismiss",
    });
  const goToNext = () => {
    if (!canIssueOrders()) return;
    const next = nextAttentionItem(items, previousKey.current);
    if (!next) return;
    previousKey.current = next.key;
    if (next.realmId === null) return openSuggestions(next.key);
    const target = structures.find((structure) => structure.entityId === next.realmId);
    if (!target) return;
    const position = structureMapPosition(setup.store, target.structure);
    if (!position) return;
    if (next.suggestionId) {
      openSuggestions(next.suggestionId);
    } else {
      void goToStructure(target.entityId, Position.fromContract(position), true);
      usePopoverStore.getState().close("suggestions");
    }
  };
  return (
    <span className="pointer-events-auto">
      <HudButton
        kind={items.length > 0 ? "primary" : "secondary"}
        icon="notifications"
        onClick={goToNext}
        disabled={items.length === 0}
        aria-label={`Attention: ${items.length}. Go to next item`}
        title={`${formatCount(targets.length, "location needs", "locations need")} attention · ${formatCount(suggestions.length, "suggested action")}`}
      >
        <span className="max-lg:hidden">Attention</span>
        {items.length > 0 && <HudChip tone="bad">{items.length}</HudChip>}
      </HudButton>
    </span>
  );
}
