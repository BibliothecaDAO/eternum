export enum HintSection {
  TheWorld = "The World",
  KeyConcepts = "Key Concepts",
  Realms = "Realms",
  Resources = "Resources",
  Transfers = "Transfers",
  TheMap = "The Map",
  Buildings = "Buildings & Bases",
  Trading = "Trading",
  Combat = "Combat",
  WorldStructures = "World Structures",
  Points = "Points",
  Tribes = "Tribes",
}

export interface Section {
  id: HintSection;
  name: string;
  order: number;
}

export const SECTIONS: Section[] = [
  { id: HintSection.TheWorld, name: "The World", order: 1 },
  { id: HintSection.KeyConcepts, name: "Key Concepts", order: 2 },
  { id: HintSection.Realms, name: "Realms", order: 3 },
  { id: HintSection.Resources, name: "Resources", order: 4 },
  { id: HintSection.Transfers, name: "Transfers", order: 5 },
  { id: HintSection.TheMap, name: "The Map", order: 6 },
  { id: HintSection.Buildings, name: "Buildings & Bases", order: 7 },
  { id: HintSection.Trading, name: "Trading", order: 8 },
  { id: HintSection.Combat, name: "Combat", order: 9 },
  { id: HintSection.WorldStructures, name: "World Structures", order: 10 },
  { id: HintSection.Points, name: "Points", order: 11 },
  { id: HintSection.Tribes, name: "Tribes", order: 12 },
].sort((a, b) => a.order - b.order);
