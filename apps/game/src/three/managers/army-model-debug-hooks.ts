import type { TroopTier } from "@bibliothecadao/types";

import type { EasingType } from "../utils/easing";
import { registerDebugHook, type DebugHookInstallOptions } from "../utils/debug-hooks";

export function installArmyModelDebugHooks(options: DebugHookInstallOptions = {}): void {
  registerDebugHook(
    "setArmyEasing",
    (easingType: EasingType) => {
      console.log(`🎮 Setting army default easing to: ${easingType}`);
    },
    options,
  );

  registerDebugHook(
    "setTierEasing",
    (tier: TroopTier, easingType: EasingType) => {
      console.log(`🎮 Setting tier ${tier} easing to: ${easingType}`);
    },
    options,
  );
}
