export type FactoryDefaultVersionGameMode = "eternum" | "blitz";

export const DEFAULT_FACTORY_CONFIG_VERSION = "140";

export const DEFAULT_FACTORY_CONFIG_VERSION_BY_MODE: Record<FactoryDefaultVersionGameMode, string> = {
  eternum: DEFAULT_FACTORY_CONFIG_VERSION,
  blitz: DEFAULT_FACTORY_CONFIG_VERSION,
};

export const resolveFactoryConfigDefaultVersion = (gameMode: FactoryDefaultVersionGameMode): string =>
  DEFAULT_FACTORY_CONFIG_VERSION_BY_MODE[gameMode];
