export interface GraphicsPreferences {
  quality: "balanced" | "high";
  shadows: boolean;
}
const STORAGE_KEY = "eternum-graphics";
export function readGraphicsPreferences(storage: Pick<Storage, "getItem"> | null): GraphicsPreferences {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    return { quality: value?.quality === "balanced" ? "balanced" : "high", shadows: value?.shadows !== false };
  } catch {
    return { quality: "high", shadows: true };
  }
}
export function writeGraphicsPreferences(storage: Pick<Storage, "setItem">, preferences: GraphicsPreferences): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
