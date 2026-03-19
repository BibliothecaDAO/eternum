import type { FactoryGameMode } from "./types";

interface FactoryLaunchModeSelection {
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
}

export type BlitzPlayStyleId =
  | "multiple-players-three-realms"
  | "two-players-three-realms"
  | "multiple-players-one-realm";

const blitzPlayStyleOptions = [
  {
    id: "multiple-players-three-realms",
    label: "Multiple Players, 3 Realms",
  },
  {
    id: "two-players-three-realms",
    label: "2 players, 3 Realms",
  },
  {
    id: "multiple-players-one-realm",
    label: "Multiple Players, 1 Realm",
  },
] satisfies Array<{ id: BlitzPlayStyleId; label: string }>;

export const supportsBlitzRegistrationModes = (mode: FactoryGameMode) => mode === "blitz";

export const getBlitzPlayStyleOptions = () => blitzPlayStyleOptions;

export const resolveSelectedBlitzPlayStyleId = ({
  twoPlayerMode,
  singleRealmMode,
}: FactoryLaunchModeSelection): BlitzPlayStyleId => {
  if (twoPlayerMode) {
    return "two-players-three-realms";
  }

  if (singleRealmMode) {
    return "multiple-players-one-realm";
  }

  return "multiple-players-three-realms";
};

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
