import { forwardRef, useMemo, useLayoutEffect } from "react";
import { Vector2 } from "three";
import { useThree } from "@react-three/fiber";
import { BlendFunction } from "postprocessing";
import { EntityIndex, setComponent, Component, Schema, Components } from "@latticexyz/recs";
import { poseidonHashMany } from "micro-starknet";
import { Position } from "../types";
import realmCoords from "../geodata/coords.json";

const isRef = (ref: any) => !!ref.current;

export const resolveRef = (ref: any) => (isRef(ref) ? ref.current : ref);

export const currencyFormat = (num: any, decimals: number) => {
  return divideByPrecision(num)
    .toFixed(decimals)
    .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
};

export const wrapEffect = (effectImpl: any, defaultBlendMode = BlendFunction.ALPHA) =>
  forwardRef(function Wrap({ blendFunction, opacity, ...props }: any, ref) {
    const invalidate = useThree((state) => state.invalidate);
    const effect = useMemo(() => new effectImpl(props), [props]);

    useLayoutEffect(() => {
      effect.blendMode.blendFunction = !blendFunction && blendFunction !== 0 ? defaultBlendMode : blendFunction;
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

// note: temp change because waiting for torii fix
// export function extractAndCleanKey(keys: (string | null)[]): bigint[] {
//   return keys.filter((value) => value !== null && value !== "").map((key) => BigInt(key as string));
// }
export function extractAndCleanKey(keys: string | null | undefined | string[]): bigint[] {
  if (Array.isArray(keys) && keys.length > 0) {
    return keys.map((key) => BigInt(key as string));
  } else {
    let stringKeys = keys as string | null | undefined;
    return (
      stringKeys
        ?.split("/")
        .slice(0, -1)
        .map((key) => BigInt(key as string)) || []
    );
  }
}

export type Entity = {
  __typename?: "Entity";
  // keys?: (string | null)[] | null | undefined;
  keys?: string | null | undefined | string[];
  models?: any | null[];
};

export function setComponentsFromEntity(entity: Entity, components: Components) {
  if (!entity || !entity.models) return;

  // Pre-calculate these to avoid redundancy
  const keys = entity?.keys ? extractAndCleanKey(entity.keys) : [];
  const entityId = getEntityIdFromKeys(keys);

  for (const rawComponentValues of entity.models) {
    if (rawComponentValues?.__typename) {
      const component = components[rawComponentValues.__typename];
      const componentValues = Object.keys(component.schema).reduce((acc: Schema, key) => {
        const value = rawComponentValues[key];
        // TODO: better way to do this? check the recs type
        acc[key] = key === "address" ? value : Number(value);
        return acc;
      }, {});

      setComponent(component, entityId, componentValues);
    }
  }
}

export function setComponentFromEntity(entity: Entity, componentName: string, components: Components) {
  if (entity) {
    let component = components[componentName];
    let rawComponentValues = entity?.models?.find((component: any) => {
      return component?.__typename === componentName;
    });
    if (rawComponentValues) {
      // setting the component values
      let keys = entity?.keys ? extractAndCleanKey(entity.keys) : [];
      let entityId = getEntityIdFromKeys(keys);
      // TODO: issue is that torii returns all numbers as strings, need to fix in torii
      // so here i am transforming to a number each time (but it will cause problem for fields that are not numbers)
      const componentValues = Object.keys(component.schema).reduce((acc: Schema, key) => {
        const value = rawComponentValues[key];
        // TODO: better way to do this? check the recs type
        acc[key] = key === "address" ? value : Number(value);
        return acc;
      }, {});

      setComponent(component, entityId, componentValues);
    }
  }
}

export const numberToHex = (num: number) => {
  return "0x" + num.toString(16);
};

export const hexToAscii = (str1: string) => {
  var hex = str1.toString();
  var str = "";
  for (var n = 0; n < hex.length; n += 2) {
    var asciiCode = parseInt(hex.substr(n, 2), 16);
    if (!isNaN(asciiCode)) {
      // Check if the parsed value is a number
      str += String.fromCharCode(asciiCode);
    }
  }
  return str;
};

export const padAddress = (address: string) => {
  return "0x" + address.substring(2).padStart(64, "0");
};

export function getFirstComponentByType(entities: Entity[] | null | undefined, typename: string): any | null {
  if (!isValidArray(entities)) return null;

  for (let entity of entities) {
    if (isValidArray(entity?.models)) {
      const foundComponent = entity.models.find((comp: any) => comp.__typename === typename);
      if (foundComponent) return foundComponent;
    }
  }

  return null;
}

export function strTofelt252Felt(str: string): string {
  const encoder = new TextEncoder();
  const strB = encoder.encode(str);
  return BigInt(
    strB.reduce((memo, byte) => {
      memo += byte.toString(16);
      return memo;
    }, "0x"),
  ).toString();
}

export function getAllComponentNames(manifest: any): any {
  return manifest.components.map((component: any) => component.name);
}

export function getAllComponentNamesAsFelt(manifest: any): any {
  return manifest.components.map((component: any) => strTofelt252Felt(component.name));
}

export function getAllSystemNames(manifest: any): any {
  return manifest.systems.map((system: any) => system.name);
}

export function getAllSystemNamesAsFelt(manifest: any): any {
  return manifest.systems.map((system: any) => strTofelt252Felt(system.name));
}

// DISCUSSION: MUD expects Numbers, but entities in Starknet are BigInts (from poseidon hash)
// so I am converting them to Numbers here, but it means that there is a bigger risk of collisions
export function getEntityIdFromKeys(keys: bigint[]): EntityIndex {
  if (keys.length === 1) {
    return parseInt(keys[0].toString()) as EntityIndex;
  }
  // calculate the poseidon hash of the keys
  let poseidon = poseidonHashMany(keys);
  return parseInt(poseidon.toString()) as EntityIndex;
}

export function setComponentFromEntitiesQuery(component: Component, entities: bigint[]) {
  let index = 0;

  // Retrieve the number of entityIds
  const numEntityIds = Number(entities[index++]);

  // Retrieve entityIds
  const entityIds = entities.slice(index, index + numEntityIds);
  index += numEntityIds;

  // Retrieve the number of entities with component values
  const numEntities = Number(entities[index++]);

  for (let i = 0; i < numEntities; i++) {
    // Retrieve the number of component values for the current entity
    const numValues = Number(entities[index++]);

    // Retrieve entity's component values
    const valueArray = entities.slice(index, index + numValues);
    const componentValues = Object.keys(component.schema).reduce((acc: Schema, key, index) => {
      const value = valueArray[index];
      acc[key] = Number(value);
      return acc;
    }, {});

    const entityIndex = parseInt(entityIds[i].toString()) as EntityIndex;
    setComponent(component, entityIndex, componentValues);

    index += numValues;
  }
}

export function setComponentFromEntitiesGraphqlQuery(component: Component, entities: Entity[]) {
  entities.forEach((entity) => {
    const keys = extractAndCleanKey(entity.keys);
    const entityIndex = getEntityIdFromKeys(keys);
    entity.models.forEach((comp: any) => {
      if (comp.__typename === component.metadata?.name) {
        const componentValues = Object.keys(component.schema).reduce((acc: Schema, key) => {
          const value = comp[key];
          acc[key] = key === "address" ? value : Number(value);
          return acc;
        }, {});
        setComponent(component, entityIndex, componentValues);
      }
    });
  });
}

export function setComponentFromEvent(components: Components, eventData: string[]) {
  // retrieve the component name
  const componentName = hex_to_ascii(eventData[0]);

  // retrieve the component from name
  const component = components[componentName];

  // get keys
  const keysNumber = parseInt(eventData[1]);
  let index = 2 + keysNumber + 1;

  const keys = eventData.slice(2, 2 + keysNumber).map((key) => BigInt(key));

  // get entityIndex from keys
  const entityIndex = getEntityIdFromKeys(keys);

  // get values
  let numberOfValues = parseInt(eventData[index++]);

  // get values
  const values = eventData.slice(index, index + numberOfValues);

  // create component object from values with schema
  const componentValues = Object.keys(component.schema).reduce((acc: Schema, key, index) => {
    const value = values[index];
    // @ts-ignore
    acc[key] = key === "address" ? value : Number(value);
    return acc;
  }, {});

  // set component
  setComponent(component, entityIndex, componentValues);
}

function hex_to_ascii(hex: string) {
  var str = "";
  for (var n = 2; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }
  return str;
}

export const formatTimeLeft = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h:${minutes}m`;
};

export function displayAddress(string: string) {
  if (string === undefined) return "unknown";
  return string.substring(0, 6) + "..." + string.substring(string.length - 4);
}

export const formatTimeLeftDaysHoursMinutes = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days} days ${hours}h:${minutes}m`;
};

export const getContractPositionFromRealPosition = (position: Position): Position => {
  const { x, y } = position;
  return {
    x: Math.floor(x * 10000 + 1800000),
    y: Math.floor(y * 10000 + 1800000),
  };
};

export const getRealmPositionFromContractPosition = (position: Position): Position => {
  const { x, y } = position;
  return {
    x: (x - 1800000) / 10000,
    y: (y - 1800000) / 10000,
  };
};

const PRECISION = 1000;

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * PRECISION);
}

export function divideByPrecision(value: number): number {
  return value / PRECISION;
}

export function getPosition(realm_id: number): { x: number; y: number } {
  const coords = realmCoords.features[realm_id - 1].geometry.coordinates.map((value) => parseInt(value));
  return { x: coords[0] + 1800000, y: coords[1] + 1800000 };
}

const HIGHEST_X = 3120937;
const LOWEST_X = 470200;

// get zone for labor auction
export function getZone(x: number): number {
  return 1 + Math.floor(((x - LOWEST_X) * 10) / (HIGHEST_X - LOWEST_X));
}

export function addressToNumber(address) {
  // Convert the address to a big integer
  let numericValue = BigInt(address);

  // Sum the digits of the numeric value
  let sum = 0;
  while (numericValue > 0) {
    sum += Number(numericValue % 5n);
    numericValue /= 5n;
  }

  // Map the sum to a number between 1 and 10
  return (sum % 5) + 1;
}
