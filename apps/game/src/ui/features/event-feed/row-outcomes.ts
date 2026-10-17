import type { Transaction } from "@/hooks/store/use-transaction-store";
import { TransactionType } from "@bibliothecadao/provider";
import type { PointsGrants } from "@/ui/features/world/hud/points-goal";

/**
 * A send's own outcome, for the one action whose row no story tells: an explore that found nothing writes no story,
 * so its row says the points every explore scores. Every other row is told by its story, in the Log's words.
 */
export const sendOutcome = (transaction: Transaction, grants: () => PointsGrants): string | null =>
  transaction.type === TransactionType.EXPLORE && transaction.status === "success"
    ? `Explored: +${grants().exploreTile.toLocaleString()} points`
    : null;
