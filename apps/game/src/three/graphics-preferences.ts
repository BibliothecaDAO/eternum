export const GRAPHICS_QUALITIES = ["balanced", "high"] as const;
export type GraphicsQuality = (typeof GRAPHICS_QUALITIES)[number];

export interface GraphicsPreferences {
  quality: GraphicsQuality;
  shadows: boolean;
}

export function resolveGraphicsQuality(value: unknown): GraphicsQuality {
  return GRAPHICS_QUALITIES.find((quality) => quality === value) ?? "high";
}

const STORAGE_KEY = "eternum-graphics";
export function readGraphicsPreferences(storage: Pick<Storage, "getItem"> | null): GraphicsPreferences {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    return { quality: resolveGraphicsQuality(value?.quality), shadows: value?.shadows !== false };
  } catch {
    return { quality: "high", shadows: true };
  }
}
export function writeGraphicsPreferences(storage: Pick<Storage, "setItem">, preferences: GraphicsPreferences): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
