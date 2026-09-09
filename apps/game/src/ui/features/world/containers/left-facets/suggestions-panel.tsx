import { useEffect, useRef } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { SuggestionChip } from "./suggestion-chip";
import { useEmpireSuggestions } from "./use-empire-suggestions";
import { useSuggestionActions } from "./use-suggestion-actions";

export function SuggestionsPanel({ selectedId }: { selectedId: string }) {
  const suggestions = useEmpireSuggestions();
  const { handleSuggestionClick, pendingRealmId, pendingSuggestionIds } = useSuggestionActions();
  const selected = useRef<HTMLDivElement>(null);
  const ordersAllowed = useUIStore(canIssueOrders);
  useEffect(() => selected.current?.scrollIntoView({ block: "nearest" }), [selectedId]);
  useEffect(() => {
    if (!ordersAllowed) usePopoverStore.getState().close("suggestions");
  }, [ordersAllowed]);
  if (!ordersAllowed) return null;
  return (
    <section className="w-[360px] max-w-full space-y-2 p-3" aria-label="Suggested actions">
      <h2 className="border-b border-gold/25 pb-2 text-sm font-semibold">Suggested actions</h2>
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          ref={suggestion.id === selectedId ? selected : undefined}
          className={suggestion.id === selectedId ? "rounded-lg ring-1 ring-gold/30" : undefined}
        >
          <SuggestionChip
            suggestion={suggestion}
            onClick={handleSuggestionClick}
            isPending={pendingSuggestionIds.includes(suggestion.id) || pendingRealmId === suggestion.realmId}
          />
        </div>
      ))}
      {suggestions.length === 0 && <p className="text-xs">No suggested actions right now.</p>}
    </section>
  );
}
