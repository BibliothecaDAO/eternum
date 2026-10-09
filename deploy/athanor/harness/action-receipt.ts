import { gameplayRejection, batchRemaining } from "@bibliothecadao/provider";
export type ActionReceipt =
  | { state: "pending" }
  | { state: "applied"; block: number; batchRemaining?: string }
  | { state: "rejected"; block: number; reason: string; statusClass?: string };
interface ReceiptEvent {
  from_address: string;
  keys: string[];
  data: string[];
}
export interface PlayReceipt {
  execution_status: string;
  block_number?: number;
  revert_reason?: string;
  events?: ReceiptEvent[];
}
export interface ReceiptScope {
  gameId: number;
  actor: string;
  games: string;
  hash: string;
}
/** Raw burst observations reuse the same receipt parser as the normal shared client. */
export function classifyPlayReceipt(receipt: PlayReceipt, scope: ReceiptScope): ActionReceipt {
  if (receipt.block_number === undefined) return { state: "pending" };
  if (receipt.execution_status === "REVERTED")
    return { state: "rejected", block: receipt.block_number, reason: receipt.revert_reason ?? "Transaction reverted" };
  if (receipt.execution_status !== "SUCCEEDED") return { state: "pending" };
  const rejection = gameplayRejection(receipt.events ?? [], scope.games, scope.hash, scope);
  if (rejection) return { state: "rejected", block: receipt.block_number, ...rejection };
  const remaining = batchRemaining(receipt.events ?? [], scope.games, scope.hash, scope);
  return { state: "applied", block: receipt.block_number, batchRemaining: remaining?.toString() };
}

const PLAYER_REJECTION = "Player action rejected: ";
/** Persisted driver errors retain this one marker for a successful invoke whose gameplay was refused. */
export function playerRejectionReason(message: string): string | undefined {
  const index = message.indexOf(PLAYER_REJECTION);
  return index < 0 ? undefined : message.slice(index + PLAYER_REJECTION.length);
}
