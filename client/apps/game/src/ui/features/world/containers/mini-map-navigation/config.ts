import { getStructureTypeName } from "@bibliothecadao/eternum";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";

export const MINI_MAP_TOGGLE_KEYS = [
  "realms",
  "armies",
  "hyperstructures",
  "banks",
  "fragmentMines",
  "quests",
] as const;

export type MiniMapToggleKey = (typeof MINI_MAP_TOGGLE_KEYS)[number];

export interface MiniMapToggleConfig {
  id: MiniMapToggleKey;
  label: string;
  imagePath: string;
}

export type VisibilityState = Record<MiniMapToggleKey, boolean>;

export const INITIAL_VISIBILITY_STATE: VisibilityState = {
  realms: true,
  armies: true,
  hyperstructures: true,
  banks: true,
  fragmentMines: true,
  quests: true,
};

export const buildToggleConfig = (isBlitz: boolean): MiniMapToggleConfig[] => {
  const toggles: MiniMapToggleConfig[] = [
    {
      id: "realms",
      label: getStructureTypeName(StructureType.Realm, isBlitz),
      imagePath: "/images/labels/realm.png",
    },
    {
      id: "armies",
      label: "Armies",
      imagePath: "/images/labels/army.png",
    },
    {
      id: "hyperstructures",
      label: getStructureTypeName(StructureType.Hyperstructure, isBlitz),
      imagePath: "/images/labels/hyperstructure.png",
    },
    {
      id: "fragmentMines",
      label: getStructureTypeName(StructureType.FragmentMine, isBlitz),
      imagePath: isBlitz ? "/images/labels/essence_rift.png" : "/images/labels/fragment_mine.png",
    },
  ];

  if (!isBlitz) {
    toggles.push(
      {
        id: "banks",
        label: getStructureTypeName(StructureType.Bank, isBlitz),
        imagePath: `images/resources/${ResourcesIds.Lords}.png`,
      },
      {
        id: "quests",
        label: "Quests",
        imagePath: "/images/labels/quest.png",
      },
    );
  }

  return toggles;
};
