import { OrderMode, ProductionType, type AutomationOrder } from "@/hooks/store/use-automation-store";
import { ResourcesIds } from "@bibliothecadao/types";
import type { ResourceOption } from "./use-automation-form";

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
  orders: Array<Omit<AutomationOrder, "id" | "producedAmount" | "createdAt">>;
  previewOrder?: Omit<AutomationOrder, "id" | "producedAmount" | "createdAt">;
}

interface MaintainResourceDefinition {
  id: string;
  resourceId: ResourcesIds;
  displayName: string;
  targetAmount: number;
  priority: number;
  bufferPercentage: number;
}

interface BundleDefinition {
  id: string;
  title: string;
  description: string;
  childPresetIds: string[];
  unavailableMessage?: (missingResources: string[]) => string;
}

const MAINTAIN_RESOURCE_PRESETS: MaintainResourceDefinition[] = [
  {
    id: "maintain-wood-4000",
    resourceId: ResourcesIds.Wood,
    displayName: "Wood",
    targetAmount: 4000,
    priority: 5,
    bufferPercentage: 10,
  },
  {
    id: "maintain-copper-4000",
    resourceId: ResourcesIds.Copper,
    displayName: "Copper",
    targetAmount: 4000,
    priority: 5,
    bufferPercentage: 10,
  },
  {
    id: "maintain-coal-4000",
    resourceId: ResourcesIds.Coal,
    displayName: "Coal",
    targetAmount: 4000,
    priority: 5,
    bufferPercentage: 10,
  },
];

const COMMON_BUNDLE_PRESETS: BundleDefinition[] = [
  {
    id: "starter-resource-bootstrap",
    title: "Starter Resource Bootstrap",
    description: "Queue Wood, Copper, and Coal maintenance orders to stabilise early infrastructure.",
    childPresetIds: MAINTAIN_RESOURCE_PRESETS.map((preset) => preset.id),
    unavailableMessage: (missingResources) =>
      `Requires production access to ${missingResources.join(", ")} in this realm.`,
  },
];

const hasResourceOption = (resourceOptions: ResourceOption[], resourceId: ResourcesIds): boolean =>
  resourceOptions.some((option) => option.id === resourceId);

const buildMaintainResourcePreset = (
  definition: MaintainResourceDefinition,
  { realmEntityId, realmName, resourceOptions }: CommonAutomationContext,
): CommonAutomationPreset => {
  if (!hasResourceOption(resourceOptions, definition.resourceId)) {
    return {
      id: definition.id,
      title: `Maintain ${definition.targetAmount.toLocaleString()} ${definition.displayName}`,
      description: `Keep your ${definition.displayName.toLowerCase()} production ready with an automatic balance order.`,
      available: false,
      unavailableReason: `This realm cannot currently produce ${definition.displayName}.`,
      orders: [],
    };
  }

  const order: Omit<AutomationOrder, "id" | "producedAmount" | "createdAt"> = {
    realmEntityId,
    realmName,
    priority: definition.priority,
    resourceToUse: definition.resourceId,
    mode: OrderMode.MaintainBalance,
    maxAmount: definition.targetAmount,
    productionType: ProductionType.ResourceToResource,
    bufferPercentage: definition.bufferPercentage,
  };

  return {
    id: definition.id,
    title: `Maintain ${definition.targetAmount.toLocaleString()} ${definition.displayName}`,
    description: `Automatically maintain at least ${definition.targetAmount.toLocaleString()} ${definition.displayName}.`,
    available: true,
    orders: [order],
    previewOrder: order,
  };
};

const buildBundlePreset = (
  definition: BundleDefinition,
  maintainPresetMap: Map<string, CommonAutomationPreset>,
  maintainDefinitionMap: Map<string, MaintainResourceDefinition>,
): CommonAutomationPreset => {
  const resolvedChildren = definition.childPresetIds
    .map((childId) => ({
      preset: maintainPresetMap.get(childId),
      definition: maintainDefinitionMap.get(childId),
    }))
    .filter((value): value is { preset: CommonAutomationPreset; definition: MaintainResourceDefinition } =>
      Boolean(value.preset && value.definition),
    );

  const missingResources = resolvedChildren
    .filter(({ preset }) => !preset.available)
    .map(({ definition }) => definition.displayName);

  const requiresAllChildren = resolvedChildren.length === definition.childPresetIds.length;

  if (missingResources.length > 0 || !requiresAllChildren) {
    const reasonResources =
      missingResources.length > 0
        ? missingResources
        : definition.childPresetIds.map((childId) => maintainDefinitionMap.get(childId)?.displayName ?? childId);

    const unavailableReason = definition.unavailableMessage
      ? definition.unavailableMessage(reasonResources)
      : `Requires ${reasonResources.join(", ")} production in this realm.`;

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      available: false,
      unavailableReason,
      orders: [],
    };
  }

  const orders = resolvedChildren.flatMap(({ preset }) => preset.orders);

  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    available: true,
    orders,
    previewOrder: resolvedChildren[0]?.preset.previewOrder,
  };
};

export const buildCommonAutomationPresets = (context: CommonAutomationContext): CommonAutomationPreset[] => {
  const maintainDefinitionMap = new Map(MAINTAIN_RESOURCE_PRESETS.map((definition) => [definition.id, definition]));
  const maintainPresets = MAINTAIN_RESOURCE_PRESETS.map((definition) =>
    buildMaintainResourcePreset(definition, context),
  );

  const maintainPresetMap = new Map(maintainPresets.map((preset) => [preset.id, preset]));

  const bundlePresets = COMMON_BUNDLE_PRESETS.map((definition) =>
    buildBundlePreset(definition, maintainPresetMap, maintainDefinitionMap),
  );

  return [...maintainPresets, ...bundlePresets];
};
