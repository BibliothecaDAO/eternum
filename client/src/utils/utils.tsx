import React, { forwardRef, useMemo, useLayoutEffect } from "react";
import { Vector2, Object3D } from "three";
import { useThree } from "@react-three/fiber";
import { Effect, BlendFunction } from "postprocessing";
import { Components, Schema, setComponent } from "@latticexyz/recs";
import { getEntityIdFromKeys } from "@dojoengine/core/dist/utils";

const isRef = (ref: any) => !!ref.current;

export const resolveRef = (ref: any) => (isRef(ref) ? ref.current : ref);

export const currencyFormat = (num: any) => {
  return num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
};

export const wrapEffect = (
  effectImpl: any,
  defaultBlendMode = BlendFunction.ALPHA,
) =>
  forwardRef(function Wrap({ blendFunction, opacity, ...props }: any, ref) {
    const invalidate = useThree((state) => state.invalidate);
    const effect = useMemo(() => new effectImpl(props), [props]);

    useLayoutEffect(() => {
      effect.blendMode.blendFunction =
        !blendFunction && blendFunction !== 0
          ? defaultBlendMode
          : blendFunction;
      if (opacity !== undefined) effect.blendMode.opacity.value = opacity;
      invalidate();
    }, [blendFunction, effect.blendMode, opacity]);
    return <primitive ref={ref} object={effect} dispose={null} />;
  });

export const useVector2 = (props: any, key: any) => {
  const vec = props[key];
  return useMemo(() => {
    if (vec instanceof Vector2) {
      return new Vector2().set(vec.x, vec.y);
    } else if (Array.isArray(vec)) {
      const [x, y] = vec;
      return new Vector2().set(x, y);
    }
  }, [vec]);
};

export function isValidArray(input: any): input is any[] {
  return Array.isArray(input) && input != null;
}

export function extractAndCleanKey(keys: string): bigint[] {
  return keys
    .split(/,/g)
    .filter((value) => value !== "")
    .map((key) => BigInt(key));
}

export type Entity = {
  __typename?: "Entity";
  keys: string;
  components?: any | null[];
};

export function setComponentFromEntity(
  entity: Entity | null,
  componentName: string,
  components: Components,
) {
  if (entity) {
    let component = components[componentName];
    let rawComponentValues = entity?.components?.find((component: any) => {
      return component?.__typename === componentName;
    });
    if (rawComponentValues) {
      // setting the component values
      let keys = extractAndCleanKey(entity?.keys);
      let entityId = getEntityIdFromKeys(keys);
      // TODO: issue is that torii returns all numbers as strings, need to fix in torii
      // so here i am transforming to a number each time (but it will cause problem for fields that are not numbers)
      const componentValues = Object.keys(component.schema).reduce(
        (acc: Schema, key) => {
          const value = rawComponentValues[key];
          acc[key] = Number(value);
          return acc;
        },
        {},
      );
      setComponent(component, entityId, componentValues);
    }
  }
}

export const numberToHex = (num: number) => {
  return "0x" + num.toString(16);
};

export function getFirstComponentByType(
  entities: any[] | null | undefined,
  typename: string,
): any | null {
  if (!isValidArray(entities)) return null;

  for (let entity of entities) {
    if (isValidArray(entity?.components)) {
      const foundComponent = entity.components.find(
        (comp: any) => comp.__typename === typename,
      );
      if (foundComponent) return foundComponent;
    }
  }

  return null;
}
