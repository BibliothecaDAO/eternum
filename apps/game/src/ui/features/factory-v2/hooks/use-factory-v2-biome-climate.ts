import { useEffect, useState } from "react";
import {
  createFactoryBiomeClimateDraft,
  randomizeFactoryBiomeSeeds,
  validateFactoryBiomeClimateDraft,
  type FactoryBiomeClimateDraft,
  type FactoryBiomeClimateFieldId,
} from "../biome-climate-options";
import type { FactoryGameMode, FactoryLaunchChain, FactoryLaunchTargetKind, FactorySeriesGameDraft } from "../types";

/**
 * Advanced biome-climate overrides for the launch being drafted: one draft for
 * a single game, one per game for a series or rotation. Drafts reset whenever
 * the launch changes chain, mode, preset, or duration.
 */
export const useFactoryV2BiomeClimate = ({
  mode,
  chain,
  launchKind,
  durationMinutes,
  presetId,
  gameName,
  seriesGames,
  rotationMaxGames,
}: {
  mode: FactoryGameMode;
  chain: FactoryLaunchChain;
  launchKind: FactoryLaunchTargetKind;
  durationMinutes: number | null;
  presetId: string | null;
  gameName: string;
  seriesGames: FactorySeriesGameDraft[];
  rotationMaxGames: number;
}) => {
  const [draftGameBiomeClimate, setDraftGameBiomeClimate] = useState(() =>
    createFactoryBiomeClimateDraft(chain, mode, durationMinutes),
  );
  const [draftSeriesBiomeClimateByGameId, setDraftSeriesBiomeClimateByGameId] = useState<
    Record<string, FactoryBiomeClimateDraft>
  >({});
  const [draftRotationBiomeClimateByGameNumber, setDraftRotationBiomeClimateByGameNumber] = useState<
    Record<number, FactoryBiomeClimateDraft>
  >({});
  const [selectedTargetId, setSelectedTargetId] = useState("game");

  const options = buildFactoryBiomeClimateOptions({
    mode,
    chain,
    launchKind,
    durationMinutes,
    gameName,
    seriesGames,
    rotationMaxGames,
    draftGameBiomeClimate,
    draftSeriesBiomeClimateByGameId,
    draftRotationBiomeClimateByGameNumber,
    selectedTargetId,
  });

  useEffect(() => {
    const nextDefaultDraft = createFactoryBiomeClimateDraft(chain, mode, durationMinutes);

    setDraftGameBiomeClimate(nextDefaultDraft);
    setDraftSeriesBiomeClimateByGameId({});
    setDraftRotationBiomeClimateByGameNumber({});
    setSelectedTargetId("game");
  }, [durationMinutes, chain, mode, presetId]);

  useEffect(() => {
    const defaultDraft = createFactoryBiomeClimateDraft(chain, mode, durationMinutes);
    const nextGameIds = new Set(seriesGames.map((game) => game.id));

    setDraftSeriesBiomeClimateByGameId((currentDrafts) => {
      const nextDrafts: Record<string, FactoryBiomeClimateDraft> = {};
      for (const game of seriesGames) {
        nextDrafts[game.id] = currentDrafts[game.id] ?? defaultDraft;
      }
      return nextDrafts;
    });

    setSelectedTargetId((currentTargetId) =>
      launchKind === "series" && !nextGameIds.has(currentTargetId) ? (seriesGames[0]?.id ?? "game") : currentTargetId,
    );
  }, [durationMinutes, seriesGames, chain, launchKind, mode]);

  useEffect(() => {
    const defaultDraft = createFactoryBiomeClimateDraft(chain, mode, durationMinutes);
    const nextGameNumbers = Array.from({ length: rotationMaxGames }, (_, index) => index + 1);
    const nextGameNumberSet = new Set(nextGameNumbers.map(String));

    setDraftRotationBiomeClimateByGameNumber((currentDrafts) => {
      const nextDrafts: Record<number, FactoryBiomeClimateDraft> = {};
      for (const gameNumber of nextGameNumbers) {
        nextDrafts[gameNumber] = currentDrafts[gameNumber] ?? defaultDraft;
      }
      return nextDrafts;
    });

    setSelectedTargetId((currentTargetId) =>
      launchKind === "rotation" && !nextGameNumberSet.has(currentTargetId) ? "1" : currentTargetId,
    );
  }, [durationMinutes, rotationMaxGames, chain, launchKind, mode]);

  useEffect(() => {
    setSelectedTargetId((currentTargetId) => {
      if (launchKind === "game") {
        return "game";
      }

      if (launchKind === "series") {
        return seriesGames.some((game) => game.id === currentTargetId)
          ? currentTargetId
          : (seriesGames[0]?.id ?? "game");
      }

      return Number(currentTargetId) >= 1 && Number(currentTargetId) <= rotationMaxGames ? currentTargetId : "1";
    });
  }, [rotationMaxGames, seriesGames, launchKind]);

  const setValue = (fieldId: FactoryBiomeClimateFieldId, value: string) => {
    updateSelectedDraft((currentDraft) => ({ ...currentDraft, [fieldId]: value }));
  };

  const randomizeSeeds = () => {
    updateSelectedDraft(randomizeFactoryBiomeSeeds);
  };

  const reset = () => {
    const defaultDraft = createFactoryBiomeClimateDraft(chain, mode, durationMinutes);
    updateSelectedDraft(() => defaultDraft);
  };

  const applyToAll = () => {
    const selectedDraft = options.draft;

    if (launchKind === "series") {
      setDraftSeriesBiomeClimateByGameId(Object.fromEntries(seriesGames.map((game) => [game.id, selectedDraft])));
      return;
    }

    if (launchKind === "rotation") {
      setDraftRotationBiomeClimateByGameNumber(
        Object.fromEntries(
          Array.from({ length: rotationMaxGames }, (_, index) => [index + 1, selectedDraft]),
        ) as Record<number, FactoryBiomeClimateDraft>,
      );
      return;
    }

    setDraftGameBiomeClimate(selectedDraft);
  };

  function updateSelectedDraft(updateDraft: (currentDraft: FactoryBiomeClimateDraft) => FactoryBiomeClimateDraft) {
    if (launchKind === "series") {
      const targetId = options.selectedTargetId;
      setDraftSeriesBiomeClimateByGameId((currentDrafts) => ({
        ...currentDrafts,
        [targetId]: updateDraft(currentDrafts[targetId] ?? options.draft),
      }));
      return;
    }

    if (launchKind === "rotation") {
      const targetNumber = Number(options.selectedTargetId);
      setDraftRotationBiomeClimateByGameNumber((currentDrafts) => ({
        ...currentDrafts,
        [targetNumber]: updateDraft(currentDrafts[targetNumber] ?? options.draft),
      }));
      return;
    }

    setDraftGameBiomeClimate((currentDraft) => updateDraft(currentDraft));
  }

  return {
    options,
    selectTarget: setSelectedTargetId,
    setValue,
    randomizeSeeds,
    reset,
    applyToAll,
  };
};

function buildFactoryBiomeClimateOptions({
  mode,
  chain,
  launchKind,
  durationMinutes,
  gameName,
  seriesGames,
  rotationMaxGames,
  draftGameBiomeClimate,
  draftSeriesBiomeClimateByGameId,
  draftRotationBiomeClimateByGameNumber,
  selectedTargetId,
}: {
  mode: FactoryGameMode;
  chain: FactoryLaunchChain;
  launchKind: FactoryLaunchTargetKind;
  durationMinutes: number | null;
  gameName: string;
  seriesGames: FactorySeriesGameDraft[];
  rotationMaxGames: number;
  draftGameBiomeClimate: FactoryBiomeClimateDraft;
  draftSeriesBiomeClimateByGameId: Record<string, FactoryBiomeClimateDraft>;
  draftRotationBiomeClimateByGameNumber: Record<number, FactoryBiomeClimateDraft>;
  selectedTargetId: string;
}) {
  const defaultDraft = createFactoryBiomeClimateDraft(chain, mode, durationMinutes);

  if (launchKind === "series") {
    return buildSeriesBiomeClimateOptions({
      chain,
      mode,
      durationMinutes,
      seriesGames,
      draftsByGameId: draftSeriesBiomeClimateByGameId,
      selectedTargetId,
      defaultDraft,
    });
  }

  if (launchKind === "rotation") {
    return buildRotationBiomeClimateOptions({
      chain,
      mode,
      durationMinutes,
      rotationMaxGames,
      draftsByGameNumber: draftRotationBiomeClimateByGameNumber,
      selectedTargetId,
      defaultDraft,
    });
  }

  const validation = validateFactoryBiomeClimateDraft(chain, mode, draftGameBiomeClimate, durationMinutes);

  return {
    draft: draftGameBiomeClimate,
    errors: validation.errors,
    targets: [{ id: "game", label: gameName.trim() || "Game" }],
    selectedTargetId: "game",
    launchDisabledReason: validation.firstError,
    gameOverrides: validation.biomeClimateOverrides,
    seriesGamesWithOverrides: seriesGames,
    rotationOverridesByGameNumber: undefined,
  };
}

function buildSeriesBiomeClimateOptions({
  chain,
  mode,
  durationMinutes,
  seriesGames,
  draftsByGameId,
  selectedTargetId,
  defaultDraft,
}: {
  chain: FactoryLaunchChain;
  mode: FactoryGameMode;
  durationMinutes: number | null;
  seriesGames: FactorySeriesGameDraft[];
  draftsByGameId: Record<string, FactoryBiomeClimateDraft>;
  selectedTargetId: string;
  defaultDraft: FactoryBiomeClimateDraft;
}) {
  const selectedGame = seriesGames.find((game) => game.id === selectedTargetId) ?? seriesGames[0];
  const selectedDraft = selectedGame ? (draftsByGameId[selectedGame.id] ?? defaultDraft) : defaultDraft;
  let firstError: string | null = null;
  const seriesGamesWithOverrides = seriesGames.map((game) => {
    const validation = validateFactoryBiomeClimateDraft(
      chain,
      mode,
      draftsByGameId[game.id] ?? defaultDraft,
      durationMinutes,
    );
    firstError ??= validation.firstError;

    return {
      ...game,
      biomeClimateOverrides: validation.biomeClimateOverrides,
    };
  });
  const selectedValidation = validateFactoryBiomeClimateDraft(chain, mode, selectedDraft, durationMinutes);

  return {
    draft: selectedDraft,
    errors: selectedValidation.errors,
    targets: seriesGames.map((game) => ({
      id: game.id,
      label: `${game.seriesGameNumber}. ${game.gameName || "Untitled game"}`,
    })),
    selectedTargetId: selectedGame?.id ?? "game",
    launchDisabledReason: firstError,
    gameOverrides: undefined,
    seriesGamesWithOverrides,
    rotationOverridesByGameNumber: undefined,
  };
}

function buildRotationBiomeClimateOptions({
  chain,
  mode,
  durationMinutes,
  rotationMaxGames,
  draftsByGameNumber,
  selectedTargetId,
  defaultDraft,
}: {
  chain: FactoryLaunchChain;
  mode: FactoryGameMode;
  durationMinutes: number | null;
  rotationMaxGames: number;
  draftsByGameNumber: Record<number, FactoryBiomeClimateDraft>;
  selectedTargetId: string;
  defaultDraft: FactoryBiomeClimateDraft;
}) {
  const gameNumbers = Array.from({ length: rotationMaxGames }, (_, index) => index + 1);
  const selectedGameNumber = gameNumbers.includes(Number(selectedTargetId)) ? Number(selectedTargetId) : 1;
  const selectedDraft = draftsByGameNumber[selectedGameNumber] ?? defaultDraft;
  const rotationOverridesByGameNumber: Record<
    number,
    NonNullable<ReturnType<typeof validateFactoryBiomeClimateDraft>["biomeClimateOverrides"]>
  > = {};
  let firstError: string | null = null;

  for (const gameNumber of gameNumbers) {
    const validation = validateFactoryBiomeClimateDraft(
      chain,
      mode,
      draftsByGameNumber[gameNumber] ?? defaultDraft,
      durationMinutes,
    );
    firstError ??= validation.firstError;

    if (validation.biomeClimateOverrides) {
      rotationOverridesByGameNumber[gameNumber] = validation.biomeClimateOverrides;
    }
  }

  const selectedValidation = validateFactoryBiomeClimateDraft(chain, mode, selectedDraft, durationMinutes);

  return {
    draft: selectedDraft,
    errors: selectedValidation.errors,
    targets: gameNumbers.map((gameNumber) => ({
      id: String(gameNumber),
      label: `Game ${gameNumber}`,
    })),
    selectedTargetId: String(selectedGameNumber),
    launchDisabledReason: firstError,
    gameOverrides: undefined,
    seriesGamesWithOverrides: [],
    rotationOverridesByGameNumber:
      Object.keys(rotationOverridesByGameNumber).length > 0 ? rotationOverridesByGameNumber : undefined,
  };
}
