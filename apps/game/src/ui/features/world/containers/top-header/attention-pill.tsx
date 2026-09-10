import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { memo, useMemo, useRef } from "react";
import Bell from "lucide-react/dist/esm/icons/bell";
import { useDojo } from "@bibliothecadao/react";
import { Position } from "@bibliothecadao/eternum";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { SuggestionsPanel } from "../left-facets/suggestions-panel";
import { useEmpireSuggestions } from "../left-facets/use-empire-suggestions";
import { TOP_PILL } from "./top-pill";
import { nextAttentionItem, resolveStructureAttention } from "./attention-policy";

export const AttentionPill = memo(() => {
  const ordersAllowed = useUIStore(canIssueOrders);
  return ordersAllowed ? <AttentionCycle /> : null;
});
AttentionPill.displayName = "AttentionPill";

function AttentionCycle() {
  const { setup } = useDojo();
  const goToStructure = useGoToStructure(setup);
  const structures = useUIStore((state) => state.playerStructures);
  const arrivedIds = useUIStore((state) => state.arrivedArrivalStructureIds);
  const suggestions = useEmpireSuggestions();
  const previousKey = useRef<string | null>(null);
  const now = Math.floor(useNowMs() / 1000);
  const { targets } = useMemo(
    () => resolveStructureAttention(structures, arrivedIds, now),
    [structures, arrivedIds, now],
  );
  const items = [
    ...targets.map((target) => ({
      key: `attention:${target.entityId}`,
      realmId: target.entityId,
      suggestionId: null as string | null,
    })),
    ...suggestions.map((suggestion) => ({
      key: `suggestion:${suggestion.id}`,
      realmId: suggestion.realmId,
      suggestionId: suggestion.id,
    })),
  ];
  const goToNext = () => {
    if (!canIssueOrders()) return;
    const next = nextAttentionItem(items, previousKey.current);
    if (!next) return;
    previousKey.current = next.key;
    const target = structures.find((structure) => structure.entityId === next.realmId);
    if (!target) return;
    const { coord_x, coord_y } = target.structure.base;
    void goToStructure(target.entityId, new Position({ x: coord_x, y: coord_y }), true);
    if (next.suggestionId) {
      usePopoverStore.getState().openSurface({
        id: "suggestions",
        content: <SuggestionsPanel selectedId={next.suggestionId} />,
        anchor: "top-center",
        mapClick: "dismiss",
      });
    } else {
      usePopoverStore.getState().close("suggestions");
    }
  };
  return (
    <button
      type="button"
      className={TOP_PILL}
      onClick={goToNext}
      disabled={items.length === 0}
      aria-label={`Attention: ${items.length}. Go to next item`}
      title={`${targets.length} locations need attention · ${suggestions.length} suggested actions`}
    >
      <Bell className="h-3.5 w-3.5" />
      <span className={HUD_LABEL_BRIGHT}>
        <span className="max-lg:hidden">Attention </span>
        {items.length}
      </span>
    </button>
  );
}
