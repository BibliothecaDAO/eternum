export const GRAPHICS_QUALITIES = ["low", "balanced", "high"] as const;
export type GraphicsQuality = (typeof GRAPHICS_QUALITIES)[number];

type GraphicsStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const STORAGE_KEY = "eternum-quality";
const RETIRED_GRAPHICS_KEY = "eternum-graphics";
const RETIRED_RENDER_MODE_KEY = "RENDER_MODE";

const isGraphicsQuality = (value: unknown): value is GraphicsQuality =>
  GRAPHICS_QUALITIES.some((quality) => quality === value);

export function readGraphicsQuality(storage: GraphicsStorage | null): GraphicsQuality {
  if (!storage) return "balanced";
  const stored = storage.getItem(STORAGE_KEY);
  if (isGraphicsQuality(stored)) return stored;
  const quality = qualityOfRetiredSettings(storage.getItem(RETIRED_GRAPHICS_KEY));
  storage.removeItem(RETIRED_GRAPHICS_KEY);
  storage.removeItem(RETIRED_RENDER_MODE_KEY);
  writeGraphicsQuality(storage, quality);
  return quality;
}

export function writeGraphicsQuality(storage: Pick<Storage, "setItem">, quality: GraphicsQuality): void {
  storage.setItem(STORAGE_KEY, quality);
}

function qualityOfRetiredSettings(stored: string | null): GraphicsQuality {
  try {
    const settings = JSON.parse(stored ?? "null");
    return settings?.quality === "balanced" || settings?.shadows === false ? "low" : "balanced";
  } catch {
    return "balanced";
  }
}
