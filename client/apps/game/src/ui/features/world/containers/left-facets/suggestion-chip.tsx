import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY, HUD_BODY_MUTED, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { memo } from "react";
import type { EmpireSuggestion } from "./use-empire-suggestions";

const TITLE_LINE_MAX = 30;
const SEPARATOR = " · ";

// Truncate the realm name so `name · label` fits a single chip line. The label
// is fixed copy so we shrink the name (player-controlled) instead.
const trimRealmName = (realmName: string, label: string): string => {
  const budget = TITLE_LINE_MAX - SEPARATOR.length - label.length;
  if (realmName.length <= budget) return realmName;
  if (budget <= 1) return realmName.slice(0, 1) + "…";
  return realmName.slice(0, budget - 1) + "…";
};

interface SuggestionChipProps {
  suggestion: EmpireSuggestion;
  onClick: (suggestion: EmpireSuggestion) => void;
  isPending: boolean;
}

export const SuggestionChip = memo(({ suggestion, onClick, isPending }: SuggestionChipProps) => {
  const Icon = suggestion.icon;
  const isPrimary = suggestion.emphasis === "primary";
  const trimmedName = trimRealmName(suggestion.realmName, suggestion.label);

  return (
    <button
      type="button"
      onClick={() => onClick(suggestion)}
      disabled={isPending}
      title={`${suggestion.realmName} · ${suggestion.label}${suggestion.reason ? ` — ${suggestion.reason}` : ""}`}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition",
        isPrimary
          ? "border-gold/60 bg-gold/10 hover:border-gold hover:bg-gold/20 shadow-[0_0_10px_rgba(223,170,84,0.18)]"
          : "border-gold/20 bg-black/30 hover:border-gold/40 hover:bg-black/40",
        isPending && "cursor-not-allowed opacity-60 hover:bg-transparent",
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", isPrimary ? "text-gold" : "text-gold/70")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate leading-tight", isPrimary ? HUD_VALUE : HUD_BODY)}>
          <span className="text-gold/55">{trimmedName}</span>
          <span className="text-gold/40"> · </span>
          {suggestion.label}
        </span>
        {suggestion.reason && (
          <span className={cn("block truncate leading-tight not-italic text-gold/55", HUD_BODY_MUTED)}>
            {suggestion.reason}
          </span>
        )}
      </span>
    </button>
  );
});

SuggestionChip.displayName = "SuggestionChip";
