import { ActionType } from "@bibliothecadao/eternum";

import { AudioManager } from "./core/AudioManager";
import type { AudioPlayOptions } from "./types";

export type UnitCommandIntent = "select" | "move" | "attack" | "explore";

const UNIT_COMMAND_SOUND_IDS: Record<UnitCommandIntent, string> = {
  select: "unit.command.select",
  move: "unit.command.move",
  attack: "unit.command.attack",
  explore: "unit.command.explore",
};

export function resolveUnitCommandSoundId(intent: UnitCommandIntent): string {
  return UNIT_COMMAND_SOUND_IDS[intent];
}

export function resolveUnitCommandSoundIdForWorldmapAction(actionType: ActionType | null | undefined): string | null {
  switch (actionType) {
    case ActionType.Move:
    case ActionType.SpireTravel:
      return resolveUnitCommandSoundId("move");
    case ActionType.Attack:
      return resolveUnitCommandSoundId("attack");
    case ActionType.Explore:
      return resolveUnitCommandSoundId("explore");
    default:
      return null;
  }
}

export function playUnitCommandSound(intent: UnitCommandIntent, options?: AudioPlayOptions) {
  return AudioManager.getInstance().play(resolveUnitCommandSoundId(intent), options);
}

export function playUnitCommandSoundForWorldmapAction(
  actionType: ActionType | null | undefined,
  options?: AudioPlayOptions,
) {
  const soundId = resolveUnitCommandSoundIdForWorldmapAction(actionType);
  if (!soundId) {
    return null;
  }

  return AudioManager.getInstance().play(soundId, options);
}
