import { type Component, type ComponentValue, type Entity, getComponentValue, type Schema } from "@dojoengine/recs";

/** The rows behind a list of entities; a row that vanished between query and read is skipped, not thrown on. */
export const readRows = <S extends Schema>(component: Component<S>, entities: Entity[]): ComponentValue<S>[] =>
  entities.map((entity) => getComponentValue(component, entity)).filter(isDefined);

export const isDefined = <T>(value: T | undefined | null): value is T => value != null;
