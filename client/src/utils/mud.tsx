import {
  Component,
  ComponentValue,
  EntityIndex,
  Indexer,
  Schema,
  componentValueEquals,
  getComponentEntities,
  getComponentValue,
  isFullComponentValue,
  isIndexer,
} from "@latticexyz/recs";

// note: this is a copy of the function from @latticexyz/recs but wiith the "componentValueEquals(value, val)" changed to !"componentValueEquals(value, val)"
export function getEntitiesWithoutValue<S extends Schema>(
  component: Component<S> | Indexer<S>,
  value: Partial<ComponentValue<S>>,
): Set<EntityIndex> {
  // Shortcut for indexers
  if (isIndexer(component) && isFullComponentValue(component, value)) {
    return component.getEntitiesWithValue(value);
  }

  // Trivial implementation for regular components
  const entities = new Set<EntityIndex>();
  for (const entity of getComponentEntities(component)) {
    const val = getComponentValue(component, entity);
    if (!componentValueEquals(value, val)) {
      entities.add(entity);
    }
  }
  return entities;
}
