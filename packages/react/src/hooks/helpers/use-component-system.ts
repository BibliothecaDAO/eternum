import { Component, ComponentUpdate, Metadata, Schema } from "@dojoengine/recs";
import { DependencyList, useEffect, useRef } from "react";

/**
 * Subscribes to a recs component's update stream and forwards updates to the provided handler.
 * The subscription is automatically cleaned up when the component unmounts or dependencies change.
 */
export const useComponentSystem = <S extends Schema>(
  component: Component<S, Metadata, unknown>,
  handler: (update: ComponentUpdate<S>) => void,
  deps: DependencyList = [],
) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const subscription = component.update$.subscribe((update) => {
      handlerRef.current(update as ComponentUpdate<S>);
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps handled manually to allow optional array input
  }, [component, ...deps]);
};
