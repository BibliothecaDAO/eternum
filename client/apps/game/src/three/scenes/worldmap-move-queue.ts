import type { ID } from "@bibliothecadao/types";
import type { ActionPath } from "@bibliothecadao/eternum";

export interface QueuedWorldmapMove {
  actionPath: ActionPath[];
  enqueuedAtMs: number;
}

/**
 * Holds at most one queued next-move per army. Used so the user can click a
 * second destination while the current optimistic tween is still playing; we
 * enqueue the intent and re-invoke the submit path when movement completes.
 *
 * Depth is intentionally capped at 1 per entity: enqueueing again replaces the
 * prior entry. This bounds the blast radius if the user spam-clicks hexes.
 */
export class WorldmapMoveQueue {
  private queued: Map<ID, QueuedWorldmapMove> = new Map();

  enqueue(entityId: ID, move: { actionPath: ActionPath[] }): void {
    this.queued.set(entityId, {
      actionPath: move.actionPath,
      enqueuedAtMs: Date.now(),
    });
  }

  dequeue(entityId: ID): QueuedWorldmapMove | undefined {
    const entry = this.queued.get(entityId);
    if (entry) this.queued.delete(entityId);
    return entry;
  }

  has(entityId: ID): boolean {
    return this.queued.has(entityId);
  }

  clear(entityId: ID): void {
    this.queued.delete(entityId);
  }

  clearAll(): void {
    this.queued.clear();
  }
}
