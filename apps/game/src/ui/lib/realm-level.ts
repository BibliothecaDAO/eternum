/**
 * A realm's or village's level as a player reads it, the one number every surface shows: Settlement is level 1, City
 * 2, Kingdom 3, Empire 4. The chain counts from 0; no surface shows that count.
 */
export const realmLevelNumber = (chainLevel: number | bigint): number => Number(chainLevel) + 1;
