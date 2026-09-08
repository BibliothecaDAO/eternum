import { memo, useMemo } from "react";
import Bell from "lucide-react/dist/esm/icons/bell";
import { useDojo } from "@bibliothecadao/react";
import { Position } from "@bibliothecadao/eternum";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { TOP_PILL, TOP_PILL_TEXT } from "./top-pill";
import { nextAttentionTarget, resolveStructureAttention } from "./attention-policy";

export const AttentionPill = memo(() => {
  const { setup } = useDojo();
  const goToStructure = useGoToStructure(setup);
  const structures = useUIStore((state) => state.playerStructures);
  const currentEntityId = useUIStore((state) => state.structureEntityId);
  const arrivedIds = useUIStore((state) => state.arrivedArrivalStructureIds);
  const arrivedCount = useUIStore((state) => state.arrivedArrivalsNumber);
  const ordersAllowed = useUIStore(canIssueOrders);
  const now = Math.floor(useNowMs() / 1000);
  const { attackedCount, targets } = useMemo(
    () => resolveStructureAttention(structures, arrivedIds, now),
    [structures, arrivedIds, now],
  );
  const count = attackedCount + arrivedCount;
  const goToNext = () => {
    const next = nextAttentionTarget(targets, currentEntityId);
    if (!next) return;
    const { coord_x, coord_y } = next.structure.base;
    void goToStructure(next.entityId, new Position({ x: coord_x, y: coord_y }), true);
  };
  if (!ordersAllowed) return null;
  return (
    <button
      type="button"
      className={TOP_PILL}
      onClick={goToNext}
      disabled={targets.length === 0}
      aria-label={`Attention: ${count}. Go to next structure`}
      title={`${attackedCount} structures under attack · ${arrivedCount} arrivals ready to claim`}
    >
      <Bell className="h-3.5 w-3.5" />
      <span className={TOP_PILL_TEXT}>Attention {count}</span>
    </button>
  );
});
AttentionPill.displayName = "AttentionPill";
