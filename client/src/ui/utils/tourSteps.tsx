import { StepType } from "@reactour/tour";

const buildResourcesSteps: StepType[] = [
  {
    selector: ".resources-cards-selector",
    content:
      "These are the only resources your realm can produce. To obtain others, trade, pillage, conquer other realms.",
    position: "bottom",
  },
];

const buildEconomicSteps: StepType[] = [
  {
    selector: ".Farm-selector",
    highlightedSelectors: [".Farm-selector", ".FishingVillage-selector"],
    content:
      "Farms and Fishing Villages produce wheat and fish respectively. These are basic resouces, used for building, traveling, ...",
    position: "bottom",
  },
  {
    selector: ".Market-selector",
    content: "Markets produce Donkeys, used to transport resources being traded.",
    position: "bottom",
  },
  {
    selector: ".WorkersHut-selector",
    content: "Workers Huts raise your population cap. Buildings require population.",
    position: "bottom",
  },
  {
    selector: ".Storehouse-selector",
    content: "Storehouses raise the resource capacity of your realm.",
    position: "right",
  },
];

const buildMilitarySteps: StepType[] = [
  {
    selector: ".Barracks-selector",
    content: "Barracks produce Knigths",
    position: "bottom",
  },
  {
    selector: ".ArcheryRange-selector",
    content: "Archery ranges produce Crossbowmen",
    position: "bottom",
  },
  {
    selector: ".Stable-selector",
    content: "Stables produce Paladins",
    position: "bottom",
  },
];

export const BuildTourSteps = [buildResourcesSteps, buildEconomicSteps, buildMilitarySteps];
