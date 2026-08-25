interface RegistrationCapacityConfig {
  mode: "blitz" | "eternum" | "unknown";
  registrationCountMax: number | null;
  twoPlayerMode: boolean;
}

const TWO_PLAYER_MODE_REGISTRATION_CAPACITY = 2;

export const resolveEffectiveRegistrationCountMax = (
  config: Pick<RegistrationCapacityConfig, "mode" | "registrationCountMax" | "twoPlayerMode"> | null | undefined,
): number | null => {
  if (!config) return null;
  if (config.mode === "blitz" && config.twoPlayerMode) {
    return TWO_PLAYER_MODE_REGISTRATION_CAPACITY;
  }
  return config.registrationCountMax;
};

export const isRegistrationCapacityReached = (
  registrationCount: number,
  registrationCountMax: number | null,
): boolean => registrationCountMax !== null && registrationCount >= registrationCountMax;
