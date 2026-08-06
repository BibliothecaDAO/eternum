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
    const blitzSections = getFactoryMoreOptionSections("blitz");
    const eternumSections = getFactoryMoreOptionSections("eternum");

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
    expect(blitzSections.flatMap((section) => section.fields.map((field) => field.label))).toContain(
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
    const draft = createFactoryMoreOptionsDraft("eternum", "mainnet");
    const result = validateFactoryMoreOptions("eternum", "mainnet", draft);

    expect(result.hasErrors).toBe(false);
    expect(result.mapConfigOverrides).toBeUndefined();
  });

  it("validates biome climate drafts and omits overrides that match the base climate", () => {
    const draft = createFactoryBiomeClimateDraft("mainnet", "blitz");
    const result = validateFactoryBiomeClimateDraft("mainnet", "blitz", draft);

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
      ...createFactoryBiomeClimateDraft("mainnet", "blitz"),
      elevationScaleBps: "12000",
      moistureSeed: "991",
    };
    const result = validateFactoryBiomeClimateDraft("mainnet", "blitz", draft);

    expect(result.hasErrors).toBe(false);
    expect(result.biomeClimateOverrides).toEqual({
      elevationScaleBps: 12_000,
      moistureSeed: 991,
    });
  });

  it("rejects invalid biome climate values", () => {
    const draft = createFactoryBiomeClimateDraft("mainnet", "blitz");
    draft.elevationScaleBps = "65536";
    draft.moistureSeed = "4.2";

    const result = validateFactoryBiomeClimateDraft("mainnet", "blitz", draft);

    expect(result.hasErrors).toBe(true);
    expect(result.errors.elevationScaleBps).toContain("between 0 and 65535");
    expect(result.errors.moistureSeed).toContain("between 0 and 4294967295");
  });

  it("converts edited percentage and integer values into raw map config overrides", () => {
    const draft = createFactoryMoreOptionsDraft("eternum", "mainnet");
    draft.bitcoinMine = "2.5";
    draft.hyperstructureCenter = "12.345";
    draft.hyperstructureRadiusMultiplier = "98.21";
    draft.hyperstructureChanceLossPerFound = "0.125";

    const result = validateFactoryMoreOptions("eternum", "mainnet", draft);

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
    const draft = createFactoryMoreOptionsDraft("blitz", "mainnet");
    draft.relicHexDistance = "256";

    const result = validateFactoryMoreOptions("blitz", "mainnet", draft);

    expect(result.hasErrors).toBe(true);
    expect(result.errors.relicHexDistance).toContain("between 0 and 255");
  });

  it("shows relic discovery interval in minutes and converts it back to raw seconds", () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "mainnet");

    expect(draft.relicDiscoveryInterval).toBe("5");

    draft.relicDiscoveryInterval = "7";

    const result = validateFactoryMoreOptions("blitz", "mainnet", draft, { twoPlayerMode: false });

    expect(result.hasErrors).toBe(false);
    expect(result.mapConfigOverrides).toMatchObject({
      relicDiscoveryIntervalSeconds: 420,
    });
  });

  it("keeps non-official Blitz durations on the base more-options defaults", () => {
    const baseDraft = createFactoryMoreOptionsDraft("blitz", "mainnet");
    const customDurationDraft = createFactoryMoreOptionsDraft("blitz", "mainnet", 45);

    expect(customDurationDraft).toEqual(baseDraft);
  });

  it("switches the displayed Blitz exploration rewards when the duration changes", () => {
    const sixtyMinuteRewards =
      getFactoryMoreOptionSections("blitz", { twoPlayerMode: false }, "mainnet", 60).find(
        (section) => section.id === "explorationRewards",
      )?.previewRows ?? [];
    const ninetyMinuteRewards =
      getFactoryMoreOptionSections("blitz", { twoPlayerMode: false }, "mainnet", 90).find(
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
    const draft = createFactoryMoreOptionsDraft("blitz", "mainnet");
    draft.maxPlayers = "12";

    const result = validateFactoryMoreOptions("blitz", "mainnet", draft, { twoPlayerMode: true });

    expect(result.hasErrors).toBe(false);
    expect(result.blitzRegistrationOverrides).toBeUndefined();
  });

  it("formats blitz prize defaults from the config and keeps precision empty until needed", () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "mainnet");

    expect(draft.prizeToken).toMatch(/^0x/i);
    expect(draft.prizeAmount).toBe("100");
    expect(draft.prizePrecision).toBe("");
  });

  it("requires explicit prize token decimals when the token address changes", () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "mainnet");
    draft.prizeToken = "0x1234";

    const result = validateFactoryMoreOptions("blitz", "mainnet", draft, { twoPlayerMode: false });

    expect(result.hasErrors).toBe(true);
    expect(result.errors.prizePrecision).toContain("required");
  });

  it("converts human prize amounts into raw blitz registration overrides", () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "mainnet");
    draft.prizeAmount = "500";

    const result = validateFactoryMoreOptions("blitz", "mainnet", draft, { twoPlayerMode: false });

    expect(result.hasErrors).toBe(false);
    expect(result.blitzRegistrationOverrides).toMatchObject({
      fee_amount: "500000000000000000000",
    });
  });

  it("uses explicit decimals when a custom prize token is selected", () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "mainnet");
    draft.prizeToken = "0x1234";
    draft.prizeAmount = "0.00004";
    draft.prizePrecision = "6";

    const result = validateFactoryMoreOptions("blitz", "mainnet", draft, { twoPlayerMode: false });

    expect(result.hasErrors).toBe(false);
    expect(result.blitzRegistrationOverrides).toEqual({
      fee_token: "0x1234",
      fee_amount: "40",
    });
  });

  it("includes map config overrides in the create-run payload", () => {
    const request = buildFactoryCreateRunRequest({
      environmentId: "mainnet.eternum",
      gameName: "etrn-test-11",
      gameStartTime: "2026-03-18T10:00:00Z",
      selectedMode: "eternum",
      selectedPreset: {
        id: "eternum-ranked-season",
        mode: "eternum",
        name: "Standard world",
        description: "The usual Eternum launch.",
        defaults: {
          startRule: "next_hour",
          devMode: false,
          twoPlayerMode: false,
          singleRealmMode: false,
        },
      },
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
      environmentId: "mainnet.blitz",
      gameName: "bltz-test-11",
      gameStartTime: "2026-03-18T10:00:00Z",
      selectedMode: "blitz",
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
        fee_token: "0x1234",
        fee_amount: "40000",
      },
    });

    expect(request.blitzRegistrationOverrides).toEqual({
      registration_count_max: 12,
      fee_token: "0x1234",
      fee_amount: "40000",
    });
  });

  it("passes workflow ref overrides through game, series, and rotation launches", () => {
    const workflowRef = "credence0x/blitz-hex-map";

    const gameRequest = buildFactoryCreateRunRequest({
      environmentId: "mainnet.blitz",
      gameName: "bltz-test-12",
      gameStartTime: "2026-03-18T10:00:00Z",
      workflowRef,
      selectedMode: "blitz",
      selectedPreset: null,
      twoPlayerMode: false,
      singleRealmMode: false,
      durationMinutes: 30,
      showsDuration: true,
    });

    const seriesRequest = buildFactoryCreateSeriesRunRequest({
      environmentId: "mainnet.blitz",
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
      environmentId: "mainnet.blitz",
      rotationName: "bltz-rotation-12",
      workflowRef,
      firstGameStartTime: "2026-03-18T10:00:00Z",
      gameIntervalMinutes: 60,
      maxGames: 10,
      advanceWindowGames: 3,
      evaluationIntervalMinutes: 15,
      selectedMode: "blitz",
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
