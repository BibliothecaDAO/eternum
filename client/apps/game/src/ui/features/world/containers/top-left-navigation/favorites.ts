import { useCallback, useState } from "react";

export const FAVORITE_STRUCTURES_STORAGE_KEY = "favoriteStructures";

export const loadFavoriteStructures = (): number[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(FAVORITE_STRUCTURES_STORAGE_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is number => typeof value === "number");
    }
    if (typeof parsed === "object" && parsed !== null) {
      // Some older clients stored IDs as strings; normalize by parsing each entry.
      return Object.values(parsed)
        .map((value) => {
          const numericValue = typeof value === "string" ? Number.parseInt(value, 10) : value;
          return Number.isFinite(numericValue) ? numericValue : null;
        })
        .filter((value): value is number => value !== null);
    }
  } catch (error) {
    console.warn("Failed to parse favorite structures from storage", error);
    window.localStorage.removeItem(FAVORITE_STRUCTURES_STORAGE_KEY);
  }

  return [];
};

export const saveFavoriteStructures = (favorites: number[]): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(FAVORITE_STRUCTURES_STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.warn("Failed to persist favorite structures", error);
  }
};

export const toggleFavoriteStructure = (favorites: number[], entityId: number): number[] => {
  return favorites.includes(entityId) ? favorites.filter((id) => id !== entityId) : [...favorites, entityId];
};

export const useFavoriteStructures = () => {
  const [favorites, setFavorites] = useState<number[]>(() => loadFavoriteStructures());

  const toggleFavorite = useCallback((entityId: number) => {
    setFavorites((previous) => {
      const updated = toggleFavoriteStructure(previous, entityId);
      saveFavoriteStructures(updated);
      return updated;
    });
  }, []);

  return { favorites, setFavorites, toggleFavorite };
};
