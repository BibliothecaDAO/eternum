import type { FactoryRotationPreviewGame } from "./types";

export const DEFAULT_FACTORY_ROTATION_MAX_GAMES = 12;
export const DEFAULT_FACTORY_ROTATION_ADVANCE_WINDOW_GAMES = 5;
export const DEFAULT_FACTORY_ROTATION_GAME_INTERVAL_MINUTES = 60;

export function buildFactoryRotationPreviewGames(params: {
  rotationName: string;
  firstStartAt: string;
  gameIntervalMinutes: number;
  advanceWindowGames: number;
}): FactoryRotationPreviewGame[] {
  const previewCount = Math.min(Math.max(params.advanceWindowGames, 1), 5);

  return Array.from({ length: previewCount }, (_, index) => {
    const seriesGameNumber = index + 1;

    return {
      id: `rotation-preview-${seriesGameNumber}`,
      gameName: buildFactoryRotationGameName(params.rotationName, seriesGameNumber),
      startAt: resolveRotationPreviewStartAt(params.firstStartAt, params.gameIntervalMinutes, index),
      seriesGameNumber,
    };
  });
}

function buildFactoryRotationGameName(rotationName: string, seriesGameNumber: number) {
  const slug = rotationName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "rotation"}-${String(seriesGameNumber).padStart(2, "0")}`;
}

function resolveRotationPreviewStartAt(startAt: string, gameIntervalMinutes: number, index: number) {
  if (!startAt || index === 0) {
    return startAt;
  }

  const baseDate = new Date(startAt);
  if (!Number.isFinite(baseDate.getTime())) {
    return startAt;
  }

  const nextDate = new Date(baseDate.getTime() + index * gameIntervalMinutes * 60_000);
  const isoString = nextDate.toISOString();
  return isoString.slice(0, 16);
}
