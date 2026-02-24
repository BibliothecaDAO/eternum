export enum HintSection {
  TheWorld = 'the-world',
  KeyConcepts = 'key-concepts',
  Realms = 'realms',
  Resources = 'resources',
  Transfers = 'transfers',
  TheMap = 'the-map',
  Buildings = 'buildings',
  Trading = 'trading',
  Combat = 'combat',
  WorldStructures = 'world-structures',
  Points = 'points',
  Tribes = 'tribes',
}

export interface Section {
  id: HintSection;
  label: string;
}

export const SECTIONS: Section[] = [
  {id: HintSection.TheWorld, label: 'The World'},
  {id: HintSection.KeyConcepts, label: 'Key Concepts'},
  {id: HintSection.Realms, label: 'Realms'},
  {id: HintSection.Resources, label: 'Resources'},
  {id: HintSection.Transfers, label: 'Transfers'},
  {id: HintSection.TheMap, label: 'The Map'},
  {id: HintSection.Buildings, label: 'Buildings'},
  {id: HintSection.Trading, label: 'Trading'},
  {id: HintSection.Combat, label: 'Combat'},
  {id: HintSection.WorldStructures, label: 'World Structures'},
  {id: HintSection.Points, label: 'Points'},
  {id: HintSection.Tribes, label: 'Tribes'},
];
