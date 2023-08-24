//# Code snippet originally written by mirshko (https://discord.com/channels/865335009915961364/1039235698856841216/1039496729323642981)

// TODO: make this work so that we don't need to query every second
import {
  ComponentUpdate,
  QueryFragment,
  Schema,
  UpdateType,
  defineQuery,
} from "@latticexyz/recs";
import { useEffect, useMemo, useState } from "react";

type DefineQueryUpdate$ = ComponentUpdate<Schema, undefined> & {
  type: UpdateType;
};

export function useDefineQuery(fragments: QueryFragment<Schema>[]) {
  const query = useMemo(() => defineQuery(fragments, { runOnInit: true }), []);

  const [state, setState] = useState<DefineQueryUpdate$[]>();

  useEffect(() => {
    const sub = query.update$.subscribe((newState) => {
      setState([newState]);
    });

    return () => sub?.unsubscribe();
  }, []);

  return state;
}
