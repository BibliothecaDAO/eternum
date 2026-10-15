import { StructureType } from "@bibliothecadao/types";
import { iconUrl } from "../icon-meaning";
export const commandArt = {
  build: iconUrl("build"),
  production: iconUrl("production"),
  military: iconUrl("military"),
  transfer: iconUrl("transfer"),
  trade: iconUrl("trade"),
};

export const categoryPaintings = {
  [StructureType.Realm]: { name: "Realms", art: iconUrl("realm") },
  [StructureType.Village]: { name: "Villages", art: iconUrl("village") },
  [StructureType.Camp]: { name: "Camps", art: iconUrl("camp") },
  [StructureType.Mine]: { name: "Mines", art: iconUrl("mine") },
  [StructureType.Hyperstructure]: { name: "Hyperstructures", art: iconUrl("hyperstructure") },
  [StructureType.Bank]: { name: "Banks", art: iconUrl("bank") },
  [StructureType.BitcoinMine]: { name: "Bitcoin mines", art: iconUrl("bitcoin-mine") },
  [StructureType.Rift]: { name: "Rifts", art: iconUrl("rift") },
  [StructureType.Ruin]: { name: "Ruins", art: iconUrl("ruin") },
  [StructureType.Stragglers]: { name: "Stragglers", art: iconUrl("stragglers") },
} satisfies Record<StructureType, { name: string; art: string }>;
