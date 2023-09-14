/**
 * This file is a modified version of the original functions used in MUD from here: https://github.com/latticexyz/mud/blob/5408f61ba7f913cf2df8fa69a5904fe0e3e75919/packages/recs/src/Query.ts#L417
 * Thanks to he Lattice team for their work on MUD and the recs library!
 */

import {
  Component,
  ComponentUpdate,
  EntityIndex,
  HasQueryFragment,
  HasValueQueryFragment,
  NotQueryFragment,
  NotValueQueryFragment,
  ProxyExpandQueryFragment,
  ProxyReadQueryFragment,
  Schema,
  UpdateType,
  componentValueEquals,
  getComponentEntities,
  getComponentValue,
  getEntitiesWithValue,
  hasComponent,
  toUpdateStream,
} from "@latticexyz/recs";
import { useEffect, useMemo, useState } from "react";

enum QueryFragmentType {
  Has = 0,
  HasValue = 1,
  Not = 2,
  NotValue = 3,
  ProxyRead = 4,
  ProxyExpand = 5,
  HasResources = 6,
  HasOrders = 7,
}

type HasResourcesQueryFragment = {
  type: QueryFragmentType.HasResources;
  component: Component;
  fungibleEntitiesComponent: Component;
  resourceComponent: Component;
  resources: number[];
};

type HasOrdersQueryFragment = {
  type: QueryFragmentType.HasOrders;
  component: Component;
  realmComponent: Component;
  orders: number[];
};

type Trade = {
  maker_order_id: number;
  taker_order_id: number;
  maker_id: number;
  taker_id: number;
};

type Realm = {
  order: number;
};

type FungibleEntities = {
  key: number;
  count: number;
};

type OrderResource = {
  resource_type: number;
  balance: number;
};

export declare type QueryFragment<T extends Schema = Schema> =
  | HasQueryFragment<T>
  | HasValueQueryFragment<T>
  | NotQueryFragment<T>
  | NotValueQueryFragment<T>
  | ProxyReadQueryFragment
  | ProxyExpandQueryFragment
  | HasResourcesQueryFragment
  | HasOrdersQueryFragment;

export declare type EntityQueryFragment<T extends Schema = Schema> =
  | HasQueryFragment<T>
  | HasValueQueryFragment<T>
  | NotQueryFragment<T>
  | NotValueQueryFragment<T>
  | HasResourcesQueryFragment
  | HasOrdersQueryFragment;

// new
import isEqual from "fast-deep-equal";
import { Observable, concat, concatMap, distinctUntilChanged, from, map, merge, of, share } from "rxjs";
import { ObservableSet, observable } from "mobx";
import { filterNullish } from "@latticexyz/utils";
import { getEntityIdFromKeys } from "../../utils/utils";

export function HasResources(
  tradeComponent: Component,
  fungibleEntitiesComponent: Component,
  resourceComponent: Component,
  resources: number[],
): HasResourcesQueryFragment {
  return {
    type: QueryFragmentType.HasResources,
    component: tradeComponent,
    fungibleEntitiesComponent,
    resourceComponent,
    resources,
  };
}

export function HasOrders(
  tradeComponent: Component,
  realmComponent: Component,
  orders: number[],
): HasOrdersQueryFragment {
  return {
    type: QueryFragmentType.HasOrders,
    component: tradeComponent,
    realmComponent,
    orders,
  };
}

export function useTradeQuery(fragments: QueryFragment[], options?: { updateOnValueChange?: boolean }) {
  const updateOnValueChange = options?.updateOnValueChange ?? true;

  const stableFragments = useDeepMemo(fragments);
  const query = useMemo(() => defineQuery(stableFragments, { runOnInit: true }), [stableFragments]);
  const [entities, setEntities] = useState([...query.matching]);

  useEffect(() => {
    setEntities([...query.matching]);
    let observable = query.update$.pipe(map(() => [...query.matching]));
    if (!updateOnValueChange) {
      // re-render only on entity array changes
      observable = observable.pipe(distinctUntilChanged((a, b) => isEqual(a, b)));
    }
    const subscription = observable.subscribe((entities: any) => setEntities(entities as any));
    return () => subscription.unsubscribe();
  }, [query, updateOnValueChange]);

  return entities;
}

export const useDeepMemo = <T,>(currentValue: T): T => {
  const [stableValue, setStableValue] = useState(currentValue);

  useEffect(() => {
    if (!isEqual(currentValue, stableValue)) {
      setStableValue(currentValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue]);

  return stableValue;
};

export function defineQuery(
  fragments: QueryFragment[],
  options?: { runOnInit?: boolean; initialSet?: Set<EntityIndex> },
): {
  update$: Observable<ComponentUpdate & { type: UpdateType }>;
  matching: ObservableSet<EntityIndex>;
} {
  const initialSet =
    options?.runOnInit || options?.initialSet ? runQuery(fragments, options.initialSet) : new Set<EntityIndex>();

  const matching = observable(initialSet);
  const initial$ = from(matching).pipe(toUpdateStream(fragments[0].component));

  const containsProxy =
    fragments.findIndex((v) => [QueryFragmentType.ProxyExpand, QueryFragmentType.ProxyRead].includes(v.type)) !== -1;

  const internal$ = merge(...fragments.map((f) => f.component.update$)) // Combine all component update streams accessed accessed in this query
    .pipe(
      containsProxy // Query contains proxies
        ? concatMap((update) => {
            // If the query contains proxy read or expand fragments, entities up or down the proxy chain might match due to this update.
            // We have to run the entire query again and compare the result.
            // TODO: We might be able to make this more efficient by first computing the set of entities that are potentially touched by this update
            // and then only rerun the query on this set.
            const newMatchingSet = runQuery(fragments, options?.initialSet);
            const updates: (ComponentUpdate & { type: UpdateType })[] = [];

            for (const previouslyMatchingEntity of matching) {
              // Entity matched before but doesn't match now
              if (!newMatchingSet.has(previouslyMatchingEntity)) {
                matching.delete(previouslyMatchingEntity);
                updates.push({
                  entity: previouslyMatchingEntity,
                  type: UpdateType.Exit,
                  component: update.component,
                  value: [undefined, undefined],
                });
              }
            }

            for (const matchingEntity of newMatchingSet) {
              if (matching.has(matchingEntity)) {
                // Entity matched before and still matches
                updates.push({
                  entity: matchingEntity,
                  type: UpdateType.Update,
                  component: update.component,
                  value: [getComponentValue(update.component, matchingEntity), undefined],
                });
              } else {
                // Entity didn't match before but matches now
                matching.add(matchingEntity);
                updates.push({
                  entity: matchingEntity,
                  type: UpdateType.Enter,
                  component: update.component,
                  value: [getComponentValue(update.component, matchingEntity), undefined],
                });
              }
            }

            return of(...updates);
          })
        : // Query does not contain proxies
          map((update) => {
            if (matching.has(update.entity)) {
              // If this entity matched the query before, check if it still matches it
              // Find fragments accessign this component (linear search is fine since the number fragments is likely small)
              const relevantFragments = fragments.filter((f) => f.component.id === update.component.id);
              const pass = relevantFragments.every((f) => passesQueryFragment(update.entity, f as EntityQueryFragment)); // We early return if the query contains proxies

              if (pass) {
                // Entity passed before and still passes, forward update
                return { ...update, type: UpdateType.Update };
              } else {
                // Entity passed before but not anymore, forward update and exit
                matching.delete(update.entity);
                return { ...update, type: UpdateType.Exit };
              }
            }

            // This entity didn't match before, check all fragments
            const pass = fragments.every((f) => passesQueryFragment(update.entity, f as EntityQueryFragment)); // We early return if the query contains proxies
            if (pass) {
              // Entity didn't pass before but passes now, forward update end enter
              matching.add(update.entity);
              return { ...update, type: UpdateType.Enter };
            }
          }),
      filterNullish(),
    );

  return {
    matching,
    update$: concat(initial$, internal$).pipe(share()),
  };
}

/**
 * Helper function to check whether a given entity passes a given query fragment.
 *
 * @param entity Entity to check.
 * @param fragment Query fragment to check.
 * @returns True if the entity passes the query fragment, else false.
 */
function passesQueryFragment<T extends Schema>(entity: EntityIndex, fragment: EntityQueryFragment<T>): boolean {
  if (fragment.type === QueryFragmentType.Has) {
    // Entity must have the given component
    return hasComponent(fragment.component, entity);
  }

  if (fragment.type === QueryFragmentType.HasValue) {
    // Entity must have the given component value
    return componentValueEquals(fragment.value, getComponentValue(fragment.component, entity));
  }

  if (fragment.type === QueryFragmentType.Not) {
    // Entity must not have the given component
    return !hasComponent(fragment.component, entity);
  }

  if (fragment.type === QueryFragmentType.NotValue) {
    // Entity must not have the given component value
    return !componentValueEquals(fragment.value, getComponentValue(fragment.component, entity));
  }

  if (fragment.type === QueryFragmentType.HasOrders) {
    return hasOrders(fragment, entity);
  }

  if (fragment.type === QueryFragmentType.HasResources) {
    return hasTradeResources(fragment, entity);
  }

  throw new Error("Unknown query fragment");
}

function hasOrders(fragment: HasOrdersQueryFragment, entity: EntityIndex): boolean {
  const trade = getComponentValue(fragment.component, entity) as Trade | undefined;

  if (!trade?.maker_order_id) return false;

  const realm = getComponentValue(fragment.realmComponent, getEntityIdFromKeys([BigInt(trade.maker_id)])) as
    | Realm
    | undefined;

  if (!realm?.order) return false;

  return fragment.orders.includes(realm.order);
}

function hasTradeResources(fragment: HasResourcesQueryFragment, entity: EntityIndex): boolean {
  const trade = getComponentValue(fragment.component, entity) as Trade | undefined;

  if (!trade) return false;

  const hasMakerResources = checkResourcesForOrder(trade.maker_order_id, fragment);
  const hasTakerResources = checkResourcesForOrder(trade.taker_order_id, fragment);

  return hasMakerResources || hasTakerResources;
}

function checkResourcesForOrder(order_id: number, fragment: HasResourcesQueryFragment): boolean {
  const fungibleEntities = getComponentValue(
    fragment.fungibleEntitiesComponent,
    getEntityIdFromKeys([BigInt(order_id)]),
  ) as FungibleEntities | undefined;

  if (!fungibleEntities) return false;

  let resourcesLeftSet = new Set(fragment.resources);
  for (let i = 0; i < fungibleEntities.count && resourcesLeftSet.size > 0; i++) {
    let orderResource = getComponentValue(
      fragment.resourceComponent,
      getEntityIdFromKeys([BigInt(order_id), BigInt(fungibleEntities.key), BigInt(i)]),
    ) as OrderResource | undefined;

    if (orderResource) resourcesLeftSet.delete(orderResource.resource_type);
  }

  return resourcesLeftSet.size === 0;
}

export function runQuery(fragments: QueryFragment[], initialSet?: Set<EntityIndex>): Set<EntityIndex> {
  let entities: Set<EntityIndex> | undefined = initialSet ? new Set([...initialSet]) : undefined; // Copy to a fresh set because it will be modified in place

  // Process fragments
  for (let i = 0; i < fragments.length; i++) {
    const fragment = fragments[i];
    // Store setting fragments for subsequent query fragments
    if (!entities) {
      // Handle entity query fragments
      // First regular fragment must be Has or HasValue
      if (fragment.type !== QueryFragmentType.Has && fragment.type !== QueryFragmentType.HasValue) {
        throw new Error("First EntityQueryFragment must be Has or HasValue");
      }

      // Create the first interim result
      entities =
        fragment.type === QueryFragmentType.Has
          ? new Set([...getComponentEntities(fragment.component)])
          : getEntitiesWithValue(fragment.component, fragment.value);
    } else {
      // There already is an interim result, apply the current fragment
      for (const entity of entities) {
        // No need to spread to an array if we're modifying the original set
        // if (fragment.type !== QueryFragmentType.HasResources) {
        // Branch 1: Simple / check if the current entity passes the query fragment
        let passes = passesQueryFragment(entity, fragment as EntityQueryFragment);

        // If the entity didn't pass the query fragment, remove it from the interim set
        if (!passes) entities.delete(entity);
      }
    }
  }
  return entities ?? new Set<EntityIndex>();
}
