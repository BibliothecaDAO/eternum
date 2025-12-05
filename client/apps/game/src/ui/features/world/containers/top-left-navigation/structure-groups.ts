import { useCallback, useEffect, useState } from "react";

export const STRUCTURE_GROUPS_STORAGE_KEY = "structureGroups";
const STRUCTURE_GROUPS_EVENT = "structureGroups:updated";

export const STRUCTURE_GROUP_COLORS = [
  { value: "gold" as const, label: "Gold", textClass: "text-gold", dotClass: "bg-gold" },
  { value: "emerald" as const, label: "Emerald", textClass: "text-emerald-300", dotClass: "bg-emerald-400" },
  { value: "sky" as const, label: "Sky", textClass: "text-sky-300", dotClass: "bg-sky-400" },
  { value: "violet" as const, label: "Violet", textClass: "text-violet-300", dotClass: "bg-violet-400" },
  { value: "rose" as const, label: "Rose", textClass: "text-rose-300", dotClass: "bg-rose-400" },
] as const;

export type StructureGroupColor = (typeof STRUCTURE_GROUP_COLORS)[number]["value"];

export type StructureGroupsMap = Partial<Record<number, StructureGroupColor>>;

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

export const loadStructureGroups = (): StructureGroupsMap => {
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

      const numericId = Number.parseInt(key, 10);

      if (!Number.isFinite(numericId)) {
        return accumulator;
      }

      accumulator[numericId] = color;
      return accumulator;
    }, {} as StructureGroupsMap);
  } catch (error) {
    console.warn("Failed to parse structure groups from storage", error);
    window.localStorage.removeItem(STRUCTURE_GROUPS_STORAGE_KEY);
    return {} as StructureGroupsMap;
  }
};

export const saveStructureGroups = (groups: StructureGroupsMap): void => {
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

export const getNextStructureGroupColor = (current: StructureGroupColor | null): StructureGroupColor | null => {
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

      if (color === null) {
        delete next[entityId];
      } else {
        next[entityId] = color;
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
