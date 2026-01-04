import type { GameModeConfig } from "@/config/game-modes";
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

export const buildToggleConfig = (mode: GameModeConfig): MiniMapToggleConfig[] => {
  const toggles: MiniMapToggleConfig[] = [
    {
      id: "realms",
      label: mode.structure.getTypeName(StructureType.Realm) ?? "Realm",
      imagePath: "/images/labels/realm.png",
    },
    {
      id: "armies",
      label: "Armies",
      imagePath: "/images/labels/army.png",
    },
    {
      id: "hyperstructures",
      label: mode.structure.getTypeName(StructureType.Hyperstructure) ?? "Hyperstructure",
      imagePath: "/images/labels/hyperstructure.png",
    },
    {
      id: "fragmentMines",
      label: mode.structure.getTypeName(StructureType.FragmentMine) ?? "Fragment Mine",
      imagePath: mode.assets.labels.fragmentMine,
    },
  ];

  if (mode.ui.showBankToggle) {
    toggles.push({
      id: "banks",
      label: mode.structure.getTypeName(StructureType.Bank) ?? "Bank",
      imagePath: `images/resources/${ResourcesIds.Lords}.png`,
    });
  }

  if (mode.ui.showQuestToggle) {
    toggles.push({
      id: "quests",
      label: "Quests",
      imagePath: "/images/labels/quest.png",
    });
  }

  return toggles;
};
