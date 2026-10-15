import { useEffect, useRef } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { SuggestionChip } from "./suggestion-chip";
import { useEmpireSuggestions } from "./use-empire-suggestions";
import { isOrderSuggestion, useSuggestionActions } from "./use-suggestion-actions";
import { useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import type { EmpireSuggestion } from "./use-empire-suggestions";

export function SuggestionsPanel({ selectedId }: { selectedId: string }) {
  const suggestions = useEmpireSuggestions();
  const { handleSuggestionClick, pendingSuggestionIds } = useSuggestionActions();
  const selected = useRef<HTMLDivElement>(null);
  const ordersAllowed = useUIStore(canIssueOrders);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
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
          {isOrderSuggestion(suggestion) ? (
            <SuggestionChip
              suggestion={suggestion}
              onClick={() => void handleSuggestionClick(suggestion)}
              isPending={pendingSuggestionIds.includes(suggestion.id)}
            />
          ) : (
            <LevelUpSuggestion suggestion={suggestion} />
          )}
        </div>
      ))}
      {suggestions.length === 0 && <p className="text-sm">No suggested actions right now.</p>}
    </section>
  );
}

/** A realm's level-up, read and sent by the realm's own step, as every surface that offers it does. */
const LevelUpSuggestion = ({ suggestion }: { suggestion: EmpireSuggestion }) => {
  const step = useRealmLevelUp(suggestion.realmId);
  return <SuggestionChip suggestion={suggestion} onClick={() => step?.run()} isPending={step?.loading ?? false} />;
};
