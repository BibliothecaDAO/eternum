import type { FactorySeriesGameDraft } from "./types";

export const DEFAULT_FACTORY_SERIES_GAME_COUNT = 3;

export function resolveNextFactorySeriesGameNumber(lastGameNumber: bigint | null | undefined) {
  if (lastGameNumber === null || lastGameNumber === undefined) {
    return 1;
  }

  return Number(lastGameNumber) + 1;
}

export function buildFactorySeriesGameDrafts(params: {
  count: number;
  currentGames: FactorySeriesGameDraft[];
  seriesName: string;
  sharedStartAt: string;
  startingGameNumber: number;
}): FactorySeriesGameDraft[] {
  const nextGames: FactorySeriesGameDraft[] = [];

  for (let index = 0; index < Math.max(params.count, 0); index += 1) {
    const currentGame = params.currentGames[index];
    const seriesGameNumber = params.startingGameNumber + index;

    nextGames.push({
      id: currentGame?.id ?? `series-game-${seriesGameNumber}`,
      gameName: resolveFactorySeriesGameName(currentGame?.gameName, params.seriesName, seriesGameNumber),
      startAt: currentGame?.startAt || params.sharedStartAt,
      seriesGameNumber,
    });
  }

  return nextGames;
}

function resolveFactorySeriesGameName(currentName: string | undefined, seriesName: string, seriesGameNumber: number) {
  if (currentName?.trim()) {
    return currentName;
  }

  const slug = toFactorySeriesSlug(seriesName);
  return `${slug || "series"}-${String(seriesGameNumber).padStart(2, "0")}`;
}

function toFactorySeriesSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
