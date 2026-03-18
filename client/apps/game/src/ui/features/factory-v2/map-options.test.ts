import { describe, expect, it } from "vitest";
import { buildFactoryCreateRunRequest } from "./create-run-request";
import {
  createFactoryMapOptionsDraft,
  createFactoryMoreOptionsDraft,
  getFactoryMoreOptionField,
  getFactoryMapOptionSections,
  validateFactoryMapOptions,
  validateFactoryMoreOptions,
} from "./map-options";

describe("Factory V2 map options", () => {
  it("shows the correct advanced fields for each mode and keeps Blitz player cap out of the advanced drawer", () => {
    const blitzSections = getFactoryMapOptionSections("blitz");
    const eternumSections = getFactoryMapOptionSections("eternum");

    expect(blitzSections.flatMap((section) => section.fields.map((field) => field.label))).toContain(
      "Essence Rift chance",
    );
    expect(blitzSections.flatMap((section) => section.fields.map((field) => field.label))).not.toContain(
      "Max players",
    );
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
  });

  it("exposes the Blitz max players field separately from advanced sections", () => {
    expect(getFactoryMoreOptionField("blitz", "maxPlayers", { twoPlayerMode: false })).toMatchObject({
      label: "Max players",
      unitLabel: "players",
    });
    expect(getFactoryMoreOptionField("blitz", "maxPlayers", { twoPlayerMode: true })).toBeNull();
  });

  it("omits map overrides when the displayed values still match the environment defaults", () => {
    const draft = createFactoryMapOptionsDraft("eternum", "slot");
    const result = validateFactoryMapOptions("eternum", "slot", draft);

    expect(result.hasErrors).toBe(false);
    expect(result.mapConfigOverrides).toBeUndefined();
  });

  it("converts edited percentage and integer values into raw map config overrides", () => {
    const draft = createFactoryMapOptionsDraft("eternum", "slot");
    draft.bitcoinMine = "2.5";
    draft.hyperstructureCenter = "12.345";
    draft.hyperstructureRadiusMultiplier = "98.21";
    draft.hyperstructureChanceLossPerFound = "0.125";

    const result = validateFactoryMapOptions("eternum", "slot", draft);

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
    const draft = createFactoryMapOptionsDraft("blitz", "slot");
    draft.relicHexDistance = "256";

    const result = validateFactoryMapOptions("blitz", "slot", draft);

    expect(result.hasErrors).toBe(true);
    expect(result.errors.relicHexDistance).toContain("between 0 and 255");
  });

  it("shows relic discovery interval in minutes and converts it back to raw seconds", () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "slot");

    expect(draft.relicDiscoveryInterval).toBe("5");

    draft.relicDiscoveryInterval = "7";

    const result = validateFactoryMoreOptions("blitz", "slot", draft, { twoPlayerMode: false });

    expect(result.hasErrors).toBe(false);
    expect(result.mapConfigOverrides).toMatchObject({
      relicDiscoveryIntervalSeconds: 420,
    });
  });

  it("omits max player overrides when two-player mode hides the field", () => {
    const draft = createFactoryMoreOptionsDraft("blitz", "slot");
    draft.maxPlayers = "12";

    const result = validateFactoryMoreOptions("blitz", "slot", draft, { twoPlayerMode: true });

    expect(result.hasErrors).toBe(false);
    expect(result.blitzRegistrationOverrides).toBeUndefined();
  });

  it("includes map config overrides in the create-run payload", () => {
    const request = buildFactoryCreateRunRequest({
      environmentId: "slot.eternum",
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
    });

    expect(request.mapConfigOverrides).toEqual({
      bitcoinMineWinProbability: 1638,
      bitcoinMineFailProbability: 63897,
    });
  });

  it("includes blitz registration overrides in the create-run payload", () => {
    const request = buildFactoryCreateRunRequest({
      environmentId: "slot.blitz",
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
      },
    });

    expect(request.blitzRegistrationOverrides).toEqual({
      registration_count_max: 12,
    });
  });
});
