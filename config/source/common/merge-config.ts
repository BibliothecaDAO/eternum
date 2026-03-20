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

function mergeValues<T>(baseValue: T | undefined, patchValue: T | undefined): T | undefined {
  if (patchValue === undefined) {
    return baseValue;
  }

  if (Array.isArray(patchValue)) {
    return structuredClone(patchValue) as T;
  }

  if (!isPlainObject(baseValue) || !isPlainObject(patchValue)) {
    return structuredClone(patchValue) as T;
  }

  const merged: Record<string, unknown> = { ...baseValue };

  for (const [key, value] of Object.entries(patchValue)) {
    merged[key] = mergeValues(merged[key] as unknown, value as unknown);
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
