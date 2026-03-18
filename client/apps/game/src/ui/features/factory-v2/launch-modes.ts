import type { FactoryGameMode } from "./types";

interface FactoryLaunchModeSelection {
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
}

export const supportsBlitzRegistrationModes = (mode: FactoryGameMode) => mode === "blitz";

export const resolveLaunchModesForMode = (
  mode: FactoryGameMode,
  selection: FactoryLaunchModeSelection,
): FactoryLaunchModeSelection =>
  supportsBlitzRegistrationModes(mode) ? selection : { twoPlayerMode: false, singleRealmMode: false };

export const toggleTwoPlayerLaunchMode = ({
  twoPlayerMode,
}: FactoryLaunchModeSelection): FactoryLaunchModeSelection => ({
  twoPlayerMode: !twoPlayerMode,
  singleRealmMode: false,
});

export const toggleSingleRealmLaunchMode = ({
  singleRealmMode,
}: FactoryLaunchModeSelection): FactoryLaunchModeSelection => ({
  twoPlayerMode: false,
  singleRealmMode: !singleRealmMode,
});
