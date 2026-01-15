import { ArrowRight } from "lucide-react";

import { formatNumber } from "@/ui/utils/utils";
import { TroopTier, TroopType } from "@bibliothecadao/types";

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
        const toneClass = tone === "positive" ? "text-gold" : tone === "negative" ? "text-danger" : "text-gold/60";

        return (
          <div key={label} className="rounded-lg border border-gold/50 bg-dark-brown/80 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gold/70">
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
            <div className="mt-3 flex items-center gap-2 text-2xl font-bold text-gold">
              <span>{formatNumber(Math.max(0, before), 0)}</span>
              <ArrowRight className="h-5 w-5 text-gold/70" />
              <span>{formatNumber(Math.max(0, after), 0)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
