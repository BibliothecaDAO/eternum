import { RelicInfo, RelicRecipientType } from "@bibliothecadao/types";

const relicTypeStyles: Record<RelicInfo["type"] | "Default", string> = {
  Stamina: "bg-relics-stamina-bg text-relics-stamina-text",
  Damage: "bg-relics-damage-bg text-relics-damage-text",
  "Damage Reduction": "bg-relics-damageReduction-bg text-relics-damageReduction-text",
  Exploration: "bg-relics-exploration-bg text-relics-exploration-text",
  Production: "bg-relics-production-bg text-relics-production-text",
  Default: "bg-relics-gray-bg text-relics-gray-text",
};

export const getRelicTypeColor = (type: RelicInfo["type"]) => relicTypeStyles[type] ?? relicTypeStyles.Default;

export const getRecipientTypeColor = (recipientType: RelicRecipientType) => {
  switch (recipientType) {
    case RelicRecipientType.Explorer:
      return "bg-red-500/20 text-red-400";
    case RelicRecipientType.Structure:
      return "bg-green-500/20 text-green-400";
  }
};
