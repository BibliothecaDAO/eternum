import type { Config } from "../../../packages/types/src/types/common";

type Primitive = bigint | boolean | null | number | string | undefined;

export type DeepPartial<T> = T extends Primitive
  ? T
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

export type ConfigPatch = DeepPartial<Config>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clonePlainObject(value: Record<string, unknown>): Record<string, unknown> {
  const cloned: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    cloned[key] = cloneValue(nestedValue);
  }

  return cloned;
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return clonePlainObject(value) as T;
}

function mergeValues<T>(baseValue: T | undefined, patchValue: T | undefined): T | undefined {
  if (patchValue === undefined) {
    return baseValue;
  }

  if (Array.isArray(patchValue)) {
    return cloneValue(patchValue);
  }

  if (!isPlainObject(baseValue) || !isPlainObject(patchValue)) {
    return cloneValue(patchValue);
  }

  const merged = clonePlainObject(baseValue);

  for (const [key, value] of Object.entries(patchValue)) {
    merged[key] = mergeValues(merged[key], value);
  }

  return merged as T;
}

export function mergeConfigPatches<T>(...patches: Array<DeepPartial<T> | undefined>): T {
  let merged: T | undefined;

  for (const patch of patches) {
    if (!patch) {
      continue;
    }

    merged = mergeValues(merged, patch as T);
  }

  return (merged ?? {}) as T;
}
