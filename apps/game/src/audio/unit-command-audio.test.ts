// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const playMock = vi.fn();

vi.mock("@bibliothecadao/eternum", () => ({
  ActionType: {
    Move: "Move",
    SpireTravel: "SpireTravel",
    Attack: "Attack",
    Explore: "Explore",
    Help: "Help",
  },
}));

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: {
    getInstance: () => ({
      play: playMock,
    }),
  },
}));

import { ActionType } from "@bibliothecadao/eternum";
import {
  playUnitCommandSound,
  playUnitCommandSoundForWorldmapAction,
  resolveUnitCommandSoundId,
  resolveUnitCommandSoundIdForWorldmapAction,
} from "./unit-command-audio";

describe("unit command audio", () => {
  beforeEach(() => {
    playMock.mockReset();
  });

  it("resolves stable sound ids for each command intent", () => {
    expect(resolveUnitCommandSoundId("select")).toBe("unit.command.select");
    expect(resolveUnitCommandSoundId("move")).toBe("unit.command.move");
    expect(resolveUnitCommandSoundId("attack")).toBe("unit.command.attack");
    expect(resolveUnitCommandSoundId("explore")).toBe("unit.command.explore");
  });

  it("maps worldmap action types to the correct command cues", () => {
    expect(resolveUnitCommandSoundIdForWorldmapAction(ActionType.Move)).toBe("unit.command.move");
    expect(resolveUnitCommandSoundIdForWorldmapAction(ActionType.SpireTravel)).toBe("unit.command.move");
    expect(resolveUnitCommandSoundIdForWorldmapAction(ActionType.Attack)).toBe("unit.command.attack");
    expect(resolveUnitCommandSoundIdForWorldmapAction(ActionType.Explore)).toBe("unit.command.explore");
    expect(resolveUnitCommandSoundIdForWorldmapAction(ActionType.Help)).toBeNull();
    expect(resolveUnitCommandSoundIdForWorldmapAction(undefined)).toBeNull();
  });

  it("plays the resolved sound through the shared audio manager", () => {
    playUnitCommandSound("select");
    playUnitCommandSoundForWorldmapAction(ActionType.Explore);
    playUnitCommandSoundForWorldmapAction(ActionType.Help);

    expect(playMock).toHaveBeenNthCalledWith(1, "unit.command.select", undefined);
    expect(playMock).toHaveBeenNthCalledWith(2, "unit.command.explore", undefined);
    expect(playMock).toHaveBeenCalledTimes(2);
  });
});
