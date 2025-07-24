import { RelicInfo, RelicRecipientType } from "@bibliothecadao/types";

export const getRelicTypeColor = (type: RelicInfo["type"]) => {
  switch (type) {
    case "Stamina":
      return "bg-relics.stamina.bg text-relics.stamina.text";
    case "Damage":
      return "bg-relics.damage.bg text-relics.damage.text";
    case "Damage Reduction":
      return "bg-relics.damageReduction.bg text-relics.damageReduction.text";
    case "Exploration":
      return "bg-relics.exploration.bg text-relics.exploration.text";
    case "Production":
      return "bg-relics.production.bg text-relics.production.text";
    default:
      return "bg-relics.gray.bg text-relics.gray.text";
  }
};

export const getRecipientTypeColor = (recipientType: RelicRecipientType) => {
  switch (recipientType) {
    case RelicRecipientType.Explorer:
      return "bg-red-500/20 text-red-400";
    case RelicRecipientType.Structure:
      return "bg-green-500/20 text-green-400";
  }
};
