export const GRAPHICS_QUALITIES = ["low", "balanced", "high"] as const;
export type GraphicsQuality = (typeof GRAPHICS_QUALITIES)[number];

export interface GraphicsPreferences {
  quality: GraphicsQuality;
  shadows: boolean;
}

const STORAGE_KEY = "eternum-graphics";

const isGraphicsQuality = (value: unknown): value is GraphicsQuality =>
  GRAPHICS_QUALITIES.some((quality) => quality === value);

export function readGraphicsPreferences(
  storage: Pick<Storage, "getItem"> | null,
  defaultQuality: GraphicsQuality,
): GraphicsPreferences {
  try {
    const stored = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    return {
      quality: isGraphicsQuality(stored?.quality) ? stored.quality : defaultQuality,
      shadows: stored?.shadows !== false,
    };
  } catch {
    return { quality: defaultQuality, shadows: true };
  }
}

export function writeGraphicsPreferences(storage: Pick<Storage, "setItem">, preferences: GraphicsPreferences): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
