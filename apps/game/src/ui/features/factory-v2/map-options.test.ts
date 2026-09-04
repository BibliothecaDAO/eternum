import { describe, expect, it } from "vitest";
import { buildFactoryCreateRotationRunRequest } from "./create-rotation-run-request";
import { buildFactoryCreateRunRequest } from "./create-run-request";
import { buildFactoryCreateSeriesRunRequest } from "./create-series-run-request";
import {
  createFactoryBiomeClimateDraft,
  validateFactoryBiomeClimateDraft,
  type FactoryBiomeClimateDraft,
} from "./biome-climate-options";
import {
  createFactoryMoreOptionsDraft,
  getFactoryMoreOptionField,
  getFactoryMoreOptionSections,
  validateFactoryMoreOptions,
} from "./map-options";

describe("Factory V2 map options", () => {
  it("shows the correct advanced fields for each mode and keeps Blitz player cap out of the advanced drawer", () => {
    const blitzSections = getFactoryMoreOptionSections("blitz", {}, "appchain");
    const eternumSections = getFactoryMoreOptionSections("eternum", {}, "appchain");

    expect(blitzSections.flatMap((section) => section.fields.map((field) => field.label))).toContain(
      "Essence Rift chance",
    );
    expect(blitzSections.flatMap((section) => section.fields.map((field) => field.label))).not.toContain("Max players");
    expect(blitzSections.flatMap((section) => section.fields.map((field) => field.label))).not.toContain(
      "Bitcoin Mine chance",
    );
    expect(eternumSections.flatMap((section) => section.fields.map((field) => field.label))).toContain(
      "Shard Mine chance",
    );
    expect(eternumSections.flatMap((section) => section.fields.map((field) => field.label))).toContain(
      "Chance loss per found",
    );
    expect(eternumSections.flatMap((section) => section.fields.map((field) => field.label))).not.toContain(
      "Relics per chest",
    );
    expect(blitzSections.flatMap((section) => section.fields.map((field) => field.label))).toContain(
      "Relic discovery interval",
    );
    expect(blitzSections.flatMap((section) => section.fields.map((field) => field.label))).not.toContain(
      "Entry ticket payment token address",
    );
    expect(blitzSections.find((section) => section.id === "explorationRewards")?.previewRows).toHaveLength(9);
  });

  it("exposes the Blitz max players field separately from advanced sections", () => {
    expect(getFactoryMoreOptionField("blitz", "maxPlayers", { twoPlayerMode: false })).toMatchObject({
      label: "Max players",
      unitLabel: "players",
    });
    expect(getFactoryMoreOptionField("blitz", "maxPlayers", { twoPlayerMode: true })).toBeNull();
  });

  it("omits map overrides when the displayed values still match the environment defaults", () => {
    const draft = createFactoryMoreOptionsDraft("eternum", "appchain");
    const result = validateFactoryMoreOptions("eternum", "appchain", draft);

    expect(result.hasErrors).toBe(false);
    expect(result.mapConfigOverrides).toBeUndefined();
  });

  it("validates biome climate drafts and omits overrides that match the base climate", () => {
    const draft = createFactoryBiomeClimateDraft("appchain", "blitz");
    const result = validateFactoryBiomeClimateDraft("appchain", "blitz", draft);

    expect(draft).toEqual({
      elevationScaleBps: "10000",
      moistureScaleBps: "10000",
      elevationBiasBps: "10000",
      moistureBiasBps: "10000",
      elevationSeed: "0",
      moistureSeed: "0",
    });
    expect(result.hasErrors).toBe(false);
    expect(result.biomeClimateOverrides).toBeUndefined();
  });

  it("returns changed biome climate values as launch overrides", () => {
    const draft: FactoryBiomeClimateDraft = {
      ...createFactoryBiomeClimateDraft("appchain", "blitz"),
      elevationScaleBps: "12000",
      moistureSeed: "991",
    };
    const result = validateFactoryBiomeClimateDraft("appchain", "blitz", draft);

    expect(result.hasErrors).toBe(false);
    expect(result.biomeClimateOverrides).toEqual({
      elevationScaleBps: 12_000,
      moistureSeed: 991,
    });
  });

  it("rejects invalid biome climate values", () => {
    const draft = createFactoryBiomeClimateDraft("appchain", "blitz");
    draft.elevationScaleBps = "65536";
    draft.moistureSeed = "4.2";

    const result = validateFactoryBiomeClimateDraft("appchain", "blitz", draft);

    expect(result.hasErrors).toBe(true);
    expect(result.errors.elevationScaleBps).toContain("between 0 and 65535");
    expect(result.errors.moistureSeed).toContain("between 0 and 4294967295");
  });

  it("converts edited percentage and integer values into raw map config overrides", () => {
    const draft = createFactoryMoreOptionsDraft("eternum", "appchain");
    draft.bitcoinMine = "2.5";
    draft.hyperstructureCenter = "12.345";
    draft.hyperstructureRadiusMultiplier = "98.21";
    draft.hyperstructureChanceLossPerFound = "0.125";

    const result = validateFactoryMoreOptions("eternum", "appchain", draft);

    expect(result.hasErrors).toBe(false);
    expect(result.mapConfigOverrides).toMatchObject({
      bitcoinMineWinProbability: 1638,
      bitcoinMineFailProbability: 63897,
      hyperstructureWinProbAtCenter: 12345,
      hyperstructureFailProbAtCenter: 87655,
      hyperstructureFailProbIncreasePerHexDistance: 9821,
      hyperstructureFailProbIncreasePerHyperstructureFound: 125,
    });
  });

  it("rejects invalid relic inputs", () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "appchain");
    draft.relicHexDistance = "256";

    const result = validateFactoryMoreOptions("blitz", "appchain", draft);

    expect(result.hasErrors).toBe(true);
    expect(result.errors.relicHexDistance).toContain("between 0 and 255");
  });

  it("shows relic discovery interval in minutes and converts it back to raw seconds", () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "appchain");

    expect(draft.relicDiscoveryInterval).toBe("5");

    draft.relicDiscoveryInterval = "7";

    const result = validateFactoryMoreOptions("blitz", "appchain", draft, { twoPlayerMode: false });

    expect(result.hasErrors).toBe(false);
    expect(result.mapConfigOverrides).toMatchObject({
      relicDiscoveryIntervalSeconds: 420,
    });
  });

  it("keeps non-official Blitz durations on the base more-options defaults", () => {
    const baseDraft = createFactoryMoreOptionsDraft("blitz", "appchain");
    const customDurationDraft = createFactoryMoreOptionsDraft("blitz", "appchain", 45);

    expect(customDurationDraft).toEqual(baseDraft);
  });

  it("switches the displayed Blitz exploration rewards when the duration changes", () => {
    const sixtyMinuteRewards =
      getFactoryMoreOptionSections("blitz", { twoPlayerMode: false }, "appchain", 60).find(
        (section) => section.id === "explorationRewards",
      )?.previewRows ?? [];
    const ninetyMinuteRewards =
      getFactoryMoreOptionSections("blitz", { twoPlayerMode: false }, "appchain", 90).find(
        (section) => section.id === "explorationRewards",
      )?.previewRows ?? [];

    expect(sixtyMinuteRewards).toHaveLength(6);
    expect(sixtyMinuteRewards[0]).toMatchObject({
      label: "Essence",
      amountLabel: "150",
      probabilityLabel: "35%",
    });
    expect(ninetyMinuteRewards).toHaveLength(9);
    expect(ninetyMinuteRewards[6]).toMatchObject({
      label: "Knight",
      amountLabel: "1,000",
      probabilityLabel: "2%",
    });
  });

  it("omits max player overrides when two-player mode hides the field", () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "appchain");
    draft.maxPlayers = "12";

    const result = validateFactoryMoreOptions("blitz", "appchain", draft, { twoPlayerMode: true });

    expect(result.hasErrors).toBe(false);
    expect(result.blitzRegistrationOverrides).toBeUndefined();
  });

  it("includes map config overrides in the create-run payload", () => {
    const request = buildFactoryCreateRunRequest({
      environmentId: "madara.blitz",
      gameName: "bltz-test-11",
      gameStartTime: "2026-03-18T10:00:00Z",
      selectedMode: "blitz",
      selectedPreset: {
        id: "blitz-fast",
        mode: "blitz",
        name: "Regular Fast (1h)",
        description: "The standard one-hour game.",
        defaults: {
          startRule: "next_hour",
          durationMinutes: 60,
          devMode: false,
          twoPlayerMode: false,
          singleRealmMode: false,
          version: "8",
        },
      },
      devModeOn: false,
      twoPlayerMode: false,
      singleRealmMode: false,
      durationMinutes: null,
      showsDuration: false,
      mapConfigOverrides: {
        bitcoinMineWinProbability: 1638,
        bitcoinMineFailProbability: 63897,
      },
      biomeClimateOverrides: {
        elevationScaleBps: 12_000,
        moistureSeed: 991,
      },
    });

    expect(request.mapConfigOverrides).toEqual({
      bitcoinMineWinProbability: 1638,
      bitcoinMineFailProbability: 63897,
    });
    expect(request.biomeClimateOverrides).toEqual({
      elevationScaleBps: 12_000,
      moistureSeed: 991,
    });
  });

  it("includes blitz registration overrides in the create-run payload", () => {
    const request = buildFactoryCreateRunRequest({
      environmentId: "madara.blitz",
      gameName: "bltz-test-11",
      gameStartTime: "2026-03-18T10:00:00Z",
      selectedMode: "blitz",
      devModeOn: false,
      selectedPreset: {
        id: "blitz-standard",
        mode: "blitz",
        name: "Standard world",
        description: "The usual Blitz launch.",
        defaults: {
          startRule: "next_hour",
          devMode: false,
          twoPlayerMode: false,
          singleRealmMode: false,
        },
      },
      twoPlayerMode: false,
      singleRealmMode: false,
      durationMinutes: 30,
      showsDuration: true,
      blitzRegistrationOverrides: {
        registration_count_max: 12,
      },
    });

    expect(request.blitzRegistrationOverrides).toEqual({
      registration_count_max: 12,
    });
  });

  it("passes workflow ref overrides through game, series, and rotation launches", () => {
    const workflowRef = "credence0x/blitz-hex-map";

    const gameRequest = buildFactoryCreateRunRequest({
      environmentId: "madara.blitz",
      gameName: "bltz-test-12",
      gameStartTime: "2026-03-18T10:00:00Z",
      workflowRef,
      selectedMode: "blitz",
      devModeOn: false,
      selectedPreset: null,
      twoPlayerMode: false,
      singleRealmMode: false,
      durationMinutes: 30,
      showsDuration: true,
    });

    const seriesRequest = buildFactoryCreateSeriesRunRequest({
      environmentId: "madara.blitz",
      seriesName: "bltz-series-12",
      workflowRef,
      games: [
        {
          id: "game-1",
          gameName: "bltz-series-12-1",
          startAt: "2026-03-18T10:00:00Z",
          seriesGameNumber: 1,
          biomeClimateOverrides: {
            elevationSeed: 101,
          },
        },
      ],
      selectedMode: "blitz",
      devModeOn: false,
      selectedPreset: null,
      twoPlayerMode: false,
      singleRealmMode: false,
      durationMinutes: 30,
      showsDuration: true,
      autoRetryIntervalMinutes: 15,
      resolveStartTime: (startAt) => startAt,
    });

    expect(seriesRequest.games[0].biomeClimateOverrides).toEqual({ elevationSeed: 101 });

    const rotationRequest = buildFactoryCreateRotationRunRequest({
      environmentId: "madara.blitz",
      rotationName: "bltz-rotation-12",
      workflowRef,
      firstGameStartTime: "2026-03-18T10:00:00Z",
      gameIntervalMinutes: 60,
      maxGames: 10,
      advanceWindowGames: 3,
      evaluationIntervalMinutes: 15,
      selectedMode: "blitz",
      devModeOn: false,
      selectedPreset: null,
      twoPlayerMode: false,
      singleRealmMode: false,
      durationMinutes: 30,
      showsDuration: true,
      autoRetryIntervalMinutes: 15,
      biomeClimateOverridesByGameNumber: {
        1: {
          elevationSeed: 202,
        },
      },
      resolveStartTime: (startAt) => startAt,
    });

    expect(gameRequest.workflowRef).toBe(workflowRef);
    expect(seriesRequest.workflowRef).toBe(workflowRef);
    expect(rotationRequest.workflowRef).toBe(workflowRef);
    expect(rotationRequest.biomeClimateOverridesByGameNumber).toEqual({
      1: {
        elevationSeed: 202,
      },
    });
  });
});
