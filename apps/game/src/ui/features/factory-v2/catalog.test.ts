import { beforeEach, describe, expect, it, vi } from "vitest";

const publicEnv = vi.hoisted(() => ({ VITE_PUBLIC_CHAIN: "madara" as "madara" | "appchain" }));

vi.mock("../../../../env", () => ({ env: publicEnv }));

import {
  getDefaultFactoryMode,
  getFactoryModeDefinitions,
  getFactoryPresetById,
  resolveFactoryEnvironmentForMode,
  resolveFactoryEnvironmentLabel,
} from "./catalog";
import { buildFactoryCreateRunRequest } from "./create-run-request";
import { createFactoryMoreOptionsDraft } from "./map-options";

describe("factory catalog environments", () => {
  beforeEach(() => {
    publicEnv.VITE_PUBLIC_CHAIN = "madara";
  });

  it("offers Blitz on the lab for a madara build", () => {
    expect(getFactoryModeDefinitions().map((mode) => mode.id)).toEqual(["blitz"]);
    expect(getDefaultFactoryMode()).toBe("blitz");
    expect(resolveFactoryEnvironmentForMode("blitz")).toEqual({
      id: "madara.blitz",
      label: "Madara",
      mode: "blitz",
      chain: "madara",
    });
  });

  it("refuses a mode the build chain has no environment for", () => {
    expect(() => resolveFactoryEnvironmentForMode("eternum")).toThrow(/eternum/);
  });

  it("keeps both appchain environments for an appchain build", () => {
    publicEnv.VITE_PUBLIC_CHAIN = "appchain";

    expect(getFactoryModeDefinitions().map((mode) => mode.id)).toEqual(["eternum", "blitz"]);
    expect(resolveFactoryEnvironmentForMode("eternum").id).toBe("appchain.eternum");
    expect(resolveFactoryEnvironmentForMode("blitz").chain).toBe("appchain");
  });

  it("labels run-record environment ids by chain", () => {
    expect(resolveFactoryEnvironmentLabel("madara.blitz")).toBe("Madara");
    expect(resolveFactoryEnvironmentLabel("appchain.eternum")).toBe("Appchain");
    expect(resolveFactoryEnvironmentLabel("retired.blitz")).toBe("Unknown");
  });
});

describe("factory launch defaults", () => {
  it("defaults the player cap to the target chain's registration config", () => {
    expect(createFactoryMoreOptionsDraft("blitz", "madara").maxPlayers).toBe("96");
    expect(createFactoryMoreOptionsDraft("blitz", "appchain").maxPlayers).toBe("24");
  });

  it("sends the preset's registrar id and leaves seed and player cap to the launcher", () => {
    const request = buildFactoryCreateRunRequest({
      environmentId: "madara.blitz",
      gameName: "bltz-lab-01",
      gameStartTime: "2026-09-01T12:00:00.000Z",
      selectedMode: "blitz",
      selectedPreset: getFactoryPresetById("blitz-fast"),
      twoPlayerMode: false,
      singleRealmMode: false,
      durationMinutes: 60,
      showsDuration: true,
    });

    expect(request).toMatchObject({
      environment: "madara.blitz",
      version: "6",
      devModeOn: false,
      durationSeconds: 3600,
    });
    expect(request).not.toHaveProperty("seed");
    expect(request.blitzRegistrationOverrides).toBeUndefined();
  });
});
