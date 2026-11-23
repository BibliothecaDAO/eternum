const SEASON_NAME = /^frontier-\d+$/;

export const seasonGameName = (startsAtSeconds: number): string => `frontier-${startsAtSeconds}`;

export const isSeasonGame = (name: string): boolean => SEASON_NAME.test(name);

export const testnetGameName = (startsAtSeconds: number): string => `testnet-${startsAtSeconds}`;
