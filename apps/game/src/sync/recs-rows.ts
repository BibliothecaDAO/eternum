import { belongsToActiveGame } from "@bibliothecadao/eternum";
import {
  type Component,
  type ComponentValue,
  getComponentEntities,
  getComponentValue,
  type Metadata,
  type Schema,
} from "@dojoengine/recs";

/**
 * Every row of one model, read straight from RECS. For the bridge, and for consumers that keep their own RECS reads
 * and recompute on a world-slice revision counter: the read happens inside a slice or a memo, never as a per-row
 * subscription.
 */
export const allRows = <S extends Schema, T = unknown>(component: Component<S, Metadata, T>): ComponentValue<S, T>[] =>
  [...getComponentEntities(component)].flatMap((entity) => {
    const row = getComponentValue(component, entity);
    return row ? [row] : [];
  });

/** The active game's rows of one model; chain-scoped models have no game id and are not for this reader. */
export const activeGameRows = <S extends Schema, T = unknown>(
  component: Component<S, Metadata, T>,
): ComponentValue<S, T>[] =>
  allRows(component).filter((row) => belongsToActiveGame(row as Parameters<typeof belongsToActiveGame>[0]));
