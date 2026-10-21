import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { TroopTier, TroopType, formatExact } from "@bibliothecadao/types";

import { TroopBadge } from "./transfer-troop-badge";

export type BalanceTone = "positive" | "negative" | "neutral";

export interface TransferBalanceCardData {
  label: string;
  before: number;
  after: number;
  tone: BalanceTone;
  changeLabel: string;
  troop?: { tier?: TroopTier | string; category?: TroopType | string };
}

interface TransferBalanceCardsProps {
  cards: TransferBalanceCardData[];
}

export const TransferBalanceCards = ({ cards }: TransferBalanceCardsProps) => {
  if (!cards.length) return null;

  return (
    <div className="grid gap-3 sm:grid-rows-2">
      {cards.map(({ label, before, after, tone, changeLabel, troop }) => {
        const toneClass =
          tone === "positive" ? "text-hud-accent" : tone === "negative" ? "text-hud-bad" : "text-hud-muted";

        return (
          <div key={label} className="rounded-lg border border-hud-line-strong bg-hud-well p-4 shadow-sm">
            <div className="flex items-center justify-between text-hud-label uppercase tracking-wide text-hud-muted">
              <span>{label}</span>
              <span className={toneClass}>{changeLabel}</span>
            </div>
            {troop?.tier && troop?.category ? (
              <div className="mt-2">
                <TroopBadge
                  category={troop.category}
                  tier={troop.tier}
                  label={troop.category ? String(troop.category) : undefined}
                  emphasize
                />
              </div>
            ) : null}
            <div className="mt-3 flex items-center gap-2 text-hud-display text-hud-accent">
              <span>{formatExact(Math.max(0, before))}</span>
              <SemanticIcon name="arrow-right" className="h-5 w-5 text-hud-muted" />
              <span>{formatExact(Math.max(0, after))}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
