import { buildGameSyncModelKeysClause } from "@bibliothecadao/eternum/game-sync";
import type { PatternMatching } from "@dojoengine/torii-client";
import type { Clause } from "@dojoengine/torii-wasm/types";
import { gameIdKey, isGameScopedModel } from "./game-scope";

export interface GlobalModelStreamConfig {
  model: string;
  keyCount?: number;
  patternMatching?: PatternMatching;
}

export const buildModelKeysClause = (models: GlobalModelStreamConfig[]): Clause =>
  buildGameSyncModelKeysClause(
    models.map(({ model, keyCount, patternMatching }) => ({
      model,
      keyCount,
      patternMatching,
      scopedKey: isGameScopedModel(model) ? gameIdKey() : undefined,
    })),
  ) as Clause;
