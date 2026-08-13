interface GameSyncModelStreamConfig {
  model: string;
  keyCount?: number;
  patternMatching?: string;
  scopedKey?: string;
}

type GameSyncModelKeysClause =
  | {
      Keys: {
        keys: Array<string | undefined>;
        pattern_matching: string;
        models: string[];
      };
    }
  | { Composite: { operator: "Or"; clauses: GameSyncModelKeysClause[] } };

const combineClauses = (clauses: GameSyncModelKeysClause[]): GameSyncModelKeysClause => {
  if (clauses.length === 1) return clauses[0];
  return { Composite: { operator: "Or", clauses } };
};

/** Builds one static scope clause. A scoped key is fixed for the session. */
export const buildGameSyncModelKeysClause = (models: GameSyncModelStreamConfig[]): GameSyncModelKeysClause => {
  const groups = models.reduce<
    Map<string, { keys: Array<string | undefined>; patternMatching: string; models: string[] }>
  >((accumulator, { model, keyCount, patternMatching = "VariableLen", scopedKey }) => {
    const normalizedKeyCount = typeof keyCount === "number" ? Math.max(0, keyCount) : 0;
    const keys = scopedKey ? [scopedKey] : new Array(Math.max(1, normalizedKeyCount)).fill(undefined);
    const signature = `${scopedKey ?? "unscoped"}:${patternMatching}:${scopedKey ? 1 : normalizedKeyCount}`;
    const group = accumulator.get(signature) ?? { keys, patternMatching, models: [] as string[] };
    group.models.push(model);
    accumulator.set(signature, group);
    return accumulator;
  }, new Map());

  return combineClauses(
    [...groups.values()].map(({ keys, patternMatching, models: groupedModels }) => ({
      Keys: { keys, pattern_matching: patternMatching, models: groupedModels },
    })),
  );
};
