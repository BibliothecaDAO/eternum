import { getScopedGameId, isGameScoped, isGameScopedModel } from "./game-scope";

interface ScopeFilterableEntity {
  hashed_keys: string;
  models: Record<string, unknown>;
}

const unwrapValue = (node: unknown): unknown =>
  node !== null && typeof node === "object" && "value" in (node as Record<string, unknown>)
    ? unwrapValue((node as Record<string, unknown>).value)
    : node;

const readGameId = (fields: unknown): number | undefined => {
  if (fields === null || typeof fields !== "object") return undefined;
  const raw = unwrapValue((fields as Record<string, unknown>).game_id);
  if (raw === undefined || raw === null) return undefined;
  const value =
    typeof raw === "bigint" ? Number(raw) : typeof raw === "number" || typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : undefined;
};

/**
 * The gamewide clause's chain-scoped arm matches entities by key tuple, and
 * small config tuples (preset id, resource id, ...) collide with early games'
 * (game_id, entity_id) tuples — torii then returns those old games' game-scoped
 * models riding the shared entity. Drop any game-scoped model that declares a
 * foreign game_id. Partial live updates without a game_id field pass through:
 * they cannot be classified, and any fragment written to an unknown entity is
 * removed by the next recovery's absence diff.
 */
export const filterEntityToActiveGameScope = <T extends ScopeFilterableEntity>(entity: T): T | null => {
  if (!isGameScoped()) return entity;

  const models = Object.entries(entity.models ?? {});
  // An empty models map is torii's deletion signal — pass it through untouched.
  if (models.length === 0) return entity;

  const activeGameId = getScopedGameId();
  const kept = models.filter(([model, fields]) => {
    if (!isGameScopedModel(model)) return true;
    const gameId = readGameId(fields);
    return gameId === undefined || gameId === activeGameId;
  });

  if (kept.length === models.length) return entity;
  // Fully foreign: never admit (writing an empty models map would delete instead).
  if (kept.length === 0) return null;
  return { ...entity, models: Object.fromEntries(kept) };
};
