import type { GameSyncEntity, GameSyncEntityStoreOperation, GameSyncStore } from "@bibliothecadao/eternum/game-sync";

export class MemoryGameSyncStore implements GameSyncStore {
  private readonly entities = new Map<string, GameSyncEntity>();
  private readonly events: GameSyncEntity[] = [];

  public applyEntityOperations(operations: readonly GameSyncEntityStoreOperation[]): void {
    for (const operation of operations) {
      if (operation.type === "upsert") {
        for (const entity of operation.entities) {
          const existing = this.entities.get(entity.hashed_keys);
          this.entities.set(entity.hashed_keys, {
            hashed_keys: entity.hashed_keys,
            models: { ...(existing?.models ?? {}), ...entity.models },
          });
        }
      } else if (operation.type === "remove-components") {
        const existing = this.entities.get(operation.entityId);
        if (!existing) continue;
        const models = { ...existing.models };
        operation.models.forEach((model) => delete models[model]);
        if (Object.keys(models).length === 0) this.entities.delete(operation.entityId);
        else this.entities.set(operation.entityId, { ...existing, models });
      } else {
        this.entities.delete(operation.entityId);
      }
    }
  }

  public applyEvent(event: GameSyncEntity): void {
    this.events.push(event);
    if (this.events.length > 512) this.events.shift();
  }

  public listModelEntityIds(model: string): Iterable<string> {
    return [...this.entities.values()].filter((entity) => model in entity.models).map((entity) => entity.hashed_keys);
  }

  public rows(model: string): Record<string, unknown>[] {
    return [...this.entities.values()].flatMap((entity) => {
      const value = entity.models[model];
      return typeof value === "object" && value !== null && !Array.isArray(value)
        ? [value as Record<string, unknown>]
        : [];
    });
  }
}
