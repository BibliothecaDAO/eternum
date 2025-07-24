import { RelicInfo, RelicRecipientType } from "@bibliothecadao/types";

export const getRelicTypeColor = (type: RelicInfo["type"]) => {
  switch (type) {
    case "Stamina":
      return "bg-green-600/20 text-green-400";
    case "Damage":
      return "bg-red-600/20 text-red-400";
    case "Damage Reduction":
      return "bg-blue-600/20 text-blue-400";
    case "Exploration":
      return "bg-purple-600/20 text-purple-400";
    case "Production":
      return "bg-yellow-600/20 text-yellow-400";
    default:
      return "bg-gray-600/20 text-gray-400";
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
