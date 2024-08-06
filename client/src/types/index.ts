export type HexPosition = { col: number; row: number };

export interface Health {
  current: bigint;
  lifetime: bigint;
}

export enum ResourceMiningTypes {
  Forge = "forge",
  Mine = "mine",
  LumberMill = "lumber_mill",
  Dragonhide = "dragonhide",
}
