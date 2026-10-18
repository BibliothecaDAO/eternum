import { useCallback, useEffect, useState } from "react";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

/** A stored group's key is a structure id; a malformed one is reported and dropped, never read as another id. */
const storedStructureId = (key: string): number | undefined => {
  try {
    return safeInteger(key);
  } catch (error) {
    console.warn(`Dropped a structure group stored under the malformed id "${key}"`, error);
    return undefined;
  }
};

const STRUCTURE_GROUPS_STORAGE_KEY = "structureGroups";
const STRUCTURE_GROUPS_EVENT = "structureGroups:updated";

export const STRUCTURE_GROUP_COLORS = [
  { value: "red" as const, label: "Red", textClass: "text-hud-group-1", dotClass: "bg-hud-group-1" },
  { value: "amber" as const, label: "Amber", textClass: "text-hud-group-2", dotClass: "bg-hud-group-2" },
  { value: "green" as const, label: "Green", textClass: "text-hud-group-3", dotClass: "bg-hud-group-3" },
  { value: "blue" as const, label: "Blue", textClass: "text-hud-group-4", dotClass: "bg-hud-group-4" },
  { value: "indigo" as const, label: "Indigo", textClass: "text-hud-group-5", dotClass: "bg-hud-group-5" },
  { value: "violet" as const, label: "Violet", textClass: "text-hud-group-6", dotClass: "bg-hud-group-6" },
] as const;

export type StructureGroupColor = (typeof STRUCTURE_GROUP_COLORS)[number]["value"];

type StructureGroupsMap = Partial<Record<number, StructureGroupColor>>;

export const STRUCTURE_GROUP_CONFIG: Record<StructureGroupColor, (typeof STRUCTURE_GROUP_COLORS)[number]> =
  STRUCTURE_GROUP_COLORS.reduce(
    (accumulator, colorConfig) => ({ ...accumulator, [colorConfig.value]: colorConfig }),
    {} as Record<StructureGroupColor, (typeof STRUCTURE_GROUP_COLORS)[number]>,
  );

const allowedGroupValues = new Set<StructureGroupColor>(STRUCTURE_GROUP_COLORS.map((config) => config.value));

const sanitizeGroupValue = (value: unknown): StructureGroupColor | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  if (allowedGroupValues.has(value as StructureGroupColor)) {
    return value as StructureGroupColor;
  }

  return undefined;
};

const loadStructureGroups = (): StructureGroupsMap => {
  if (typeof window === "undefined") {
    return {} as StructureGroupsMap;
  }

  const stored = window.localStorage.getItem(STRUCTURE_GROUPS_STORAGE_KEY);

  if (!stored) {
    return {} as StructureGroupsMap;
  }

  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>;

    if (!parsed || typeof parsed !== "object") {
      return {} as StructureGroupsMap;
    }

    return Object.entries(parsed).reduce<StructureGroupsMap>((accumulator, [key, value]) => {
      const color = sanitizeGroupValue(value);

      if (!color) {
        return accumulator;
      }

      const structureId = storedStructureId(key);
      if (structureId === undefined) return accumulator;

      accumulator[structureId] = color;
      return accumulator;
    }, {} as StructureGroupsMap);
  } catch (error) {
    console.warn("Failed to parse structure groups from storage", error);
    window.localStorage.removeItem(STRUCTURE_GROUPS_STORAGE_KEY);
    return {} as StructureGroupsMap;
  }
};

const saveStructureGroups = (groups: StructureGroupsMap): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STRUCTURE_GROUPS_STORAGE_KEY, JSON.stringify(groups));
    window.dispatchEvent(new CustomEvent(STRUCTURE_GROUPS_EVENT, { detail: groups }));
  } catch (error) {
    console.warn("Failed to persist structure groups", error);
  }
};

const getNextStructureGroupColor = (current: StructureGroupColor | null): StructureGroupColor | null => {
  const values = STRUCTURE_GROUP_COLORS.map((config) => config.value);

  if (current === null) {
    return values[0] ?? null;
  }

  const currentIndex = values.indexOf(current);

  if (currentIndex === -1) {
    return values[0] ?? null;
  }

  const nextIndex = (currentIndex + 1) % (values.length + 1);

  if (nextIndex === values.length) {
    return null;
  }

  return values[nextIndex];
};

export const useStructureGroups = () => {
  const [structureGroups, setStructureGroups] = useState<StructureGroupsMap>(() => loadStructureGroups());

  const updateStructureGroup = useCallback((entityId: number, color: StructureGroupColor | null) => {
    setStructureGroups((previous) => {
      const next = { ...previous } as StructureGroupsMap;

      const sanitizedColor = color === null ? null : sanitizeGroupValue(color);

      if (sanitizedColor === undefined) {
        return previous;
      }

      if (sanitizedColor === null) {
        delete next[entityId];
      } else {
        next[entityId] = sanitizedColor;
      }

      saveStructureGroups(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<StructureGroupsMap>;
      if (customEvent.detail) {
        setStructureGroups(customEvent.detail);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STRUCTURE_GROUPS_STORAGE_KEY) {
        setStructureGroups(loadStructureGroups());
      }
    };

    window.addEventListener(STRUCTURE_GROUPS_EVENT, handleCustomUpdate as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(STRUCTURE_GROUPS_EVENT, handleCustomUpdate as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return { structureGroups, updateStructureGroup };
};
