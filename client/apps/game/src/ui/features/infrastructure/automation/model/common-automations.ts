import {
  OrderMode,
  ProductionType,
  type AutomationOrder,
} from "@/hooks/store/use-automation-store";
import type { ResourceOption } from "./use-automation-form";
import { ResourcesIds } from "@bibliothecadao/types";

export interface CommonAutomationContext {
  realmEntityId: string;
  realmName: string;
  resourceOptions: ResourceOption[];
}

export interface CommonAutomationPreset {
  id: string;
  title: string;
  description: string;
  available: boolean;
  unavailableReason?: string;
  order?: Omit<AutomationOrder, "id" | "producedAmount">;
}

const hasResourceOption = (resourceOptions: ResourceOption[], resourceId: ResourcesIds): boolean =>
  resourceOptions.some((option) => option.id === resourceId);

const buildMaintainWoodPreset = ({
  realmEntityId,
  realmName,
  resourceOptions,
}: CommonAutomationContext): CommonAutomationPreset => {
  if (!hasResourceOption(resourceOptions, ResourcesIds.Wood)) {
    return {
      id: "maintain-wood-1000",
      title: "Maintain 1,000 Wood",
      description: "Keep your stockpile topped up with an automatic production order.",
      available: false,
      unavailableReason: "This realm cannot currently produce Wood.",
    };
  }

  return {
    id: "maintain-wood-1000",
    title: "Maintain 1,000 Wood",
    description: "Automatically maintain at least 1,000 Wood with a balance order.",
    available: true,
    order: {
      realmEntityId,
      realmName,
      priority: 5,
      resourceToUse: ResourcesIds.Wood,
      mode: OrderMode.MaintainBalance,
      maxAmount: 1000,
      productionType: ProductionType.ResourceToResource,
      bufferPercentage: 10,
    },
  };
};

export const buildCommonAutomationPresets = (context: CommonAutomationContext): CommonAutomationPreset[] => [
  buildMaintainWoodPreset(context),
];
