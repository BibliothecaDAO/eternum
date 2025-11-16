import { LeftView } from "@/types";
import { ContextMenuAction, ContextMenuIcon, ContextMenuRadialOptions } from "@/types/context-menu";
import { CONTEXT_MENU_CONFIG } from "@/ui/config";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SetupResult } from "@bibliothecadao/dojo";
import {
  configManager,
  divideByPrecision,
  getBalance,
  getBlockTimestamp,
  getBuildingCosts,
  getRealmInfo,
  hasEnoughPopulationForBuilding,
} from "@bibliothecadao/eternum";
import {
  BuildingType,
  HexEntityInfo,
  ResourcesIds,
  findResourceById,
  getBuildingFromResource,
} from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "@dojoengine/utils";

type Components = SetupResult["components"];

interface CreateConstructionMenuParams {
  structure: HexEntityInfo;
  components: Components;
  simpleCostEnabled: boolean;
  selectConstructionBuilding: (building: BuildingType, view: LeftView, resource?: ResourcesIds) => void;
}

export interface ConstructionMenuResult {
  constructionAction: ContextMenuAction;
  radialOptions: ContextMenuRadialOptions;
}

const romanToNumber: Record<string, string> = { I: "1", II: "2", III: "3" };

const militaryTierConfig: Array<{
  suffix: string;
  label: string;
  units: Array<{ label: string; building: BuildingType; resource: ResourcesIds }>;
}> = [
  {
    suffix: "tier-1",
    label: "Tier I",
    units: [
      { label: "Crossbowman", building: BuildingType.ResourceCrossbowmanT1, resource: ResourcesIds.Crossbowman },
      { label: "Paladin", building: BuildingType.ResourcePaladinT1, resource: ResourcesIds.Paladin },
      { label: "Knight", building: BuildingType.ResourceKnightT1, resource: ResourcesIds.Knight },
    ],
  },
  {
    suffix: "tier-2",
    label: "Tier II",
    units: [
      { label: "Crossbowman", building: BuildingType.ResourceCrossbowmanT2, resource: ResourcesIds.CrossbowmanT2 },
      { label: "Paladin", building: BuildingType.ResourcePaladinT2, resource: ResourcesIds.PaladinT2 },
      { label: "Knight", building: BuildingType.ResourceKnightT2, resource: ResourcesIds.KnightT2 },
    ],
  },
  {
    suffix: "tier-3",
    label: "Tier III",
    units: [
      { label: "Crossbowman", building: BuildingType.ResourceCrossbowmanT3, resource: ResourcesIds.CrossbowmanT3 },
      { label: "Paladin", building: BuildingType.ResourcePaladinT3, resource: ResourcesIds.PaladinT3 },
      { label: "Knight", building: BuildingType.ResourceKnightT3, resource: ResourcesIds.KnightT3 },
    ],
  },
];

const toSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const createResourceIconComponent = (
  resource: string | ResourcesIds | null | undefined,
  isDisabled: boolean = false,
): ContextMenuIcon | undefined => {
  if (resource === undefined || resource === null) {
    return undefined;
  }

  const resourceName =
    typeof resource === "number" ? (findResourceById(resource)?.trait ?? ResourcesIds[resource]) : resource;

  if (!resourceName) {
    return undefined;
  }

  return {
    radial: (
      <ResourceIcon
        resource={resourceName}
        size="lg"
        withTooltip={false}
        className={`pointer-events-none ${isDisabled ? "opacity-40 grayscale" : ""}`}
      />
    ),
    list: (
      <ResourceIcon
        resource={resourceName}
        size="sm"
        withTooltip={false}
        className={`pointer-events-none ${isDisabled ? "opacity-40 grayscale" : ""}`}
      />
    ),
  };
};

const createTierIconComponent = (tierLabel: string): ContextMenuIcon => ({
  radial: (
    <span className="pointer-events-none flex h-full w-full items-center justify-center text-sm font-semibold text-gold">
      {tierLabel}
    </span>
  ),
  list: <span className="pointer-events-none text-xs font-semibold uppercase text-gold">{tierLabel}</span>,
});

export const createConstructionMenu = ({
  structure,
  components,
  simpleCostEnabled,
  selectConstructionBuilding,
}: CreateConstructionMenuParams): ConstructionMenuResult => {
  const structureId = BigInt(structure.id);
  const idString = structureId.toString();
  const structureEntityId = Number(structureId);
  const { currentDefaultTick } = getBlockTimestamp();

  const realmInfo = (() => {
    try {
      return getRealmInfo(getEntityIdFromKeys([structureId]), components);
    } catch {
      return undefined;
    }
  })();

  const checkBalance = (cost: Record<string, { resource: ResourcesIds; amount: number }> | Array<any>) =>
    Object.values(cost).every((entry: any) => {
      if (!entry) {
        return true;
      }
      const balance = getBalance(structureEntityId, entry.resource, currentDefaultTick, components);
      return divideByPrecision(balance.balance) >= entry.amount;
    });

  const makeBuildingAction = ({
    suffix,
    label,
    icon,
    building,
    view,
    resource,
    iconComponent,
    disabled,
    hint,
  }: {
    suffix: string;
    label: string;
    icon?: string;
    building: BuildingType;
    view: LeftView;
    resource?: ResourcesIds;
    iconComponent?: ContextMenuIcon;
    disabled?: boolean;
    hint?: string;
  }): ContextMenuAction => ({
    id: `structure-${idString}-${suffix}`,
    label,
    icon,
    iconComponent,
    disabled,
    hint,
    onSelect: () => {
      if (disabled) {
        return;
      }
      selectConstructionBuilding(building, view, resource);
    },
  });

  const createActionWithAvailability = ({
    suffix,
    label,
    icon,
    building,
    resource,
    iconResource,
    requiresCapacity = true,
    requiresPopulation = true,
    requiresStandardCost = false,
  }: {
    suffix: string;
    label: string;
    icon?: string;
    building: BuildingType;
    resource?: ResourcesIds;
    iconResource?: string | ResourcesIds | null;
    requiresCapacity?: boolean;
    requiresPopulation?: boolean;
    requiresStandardCost?: boolean;
  }): ContextMenuAction | null => {
    const buildingCosts = getBuildingCosts(structureEntityId, components, building, simpleCostEnabled);

    if (!buildingCosts) {
      return null;
    }

    const hasBalance = checkBalance(buildingCosts as any);
    const populationConfig = configManager.getBuildingCategoryConfig(building);
    const populationCost = populationConfig?.population_cost ?? 0;
    const hasEnoughPopulation = requiresPopulation
      ? realmInfo
        ? hasEnoughPopulationForBuilding(realmInfo, populationCost)
        : false
      : true;
    const realmHasCapacity = requiresCapacity ? (realmInfo?.hasCapacity ?? false) : true;
    const simpleModeAllowed = requiresStandardCost ? !simpleCostEnabled : true;
    const canBuild = hasBalance && realmHasCapacity && hasEnoughPopulation && simpleModeAllowed;

    let hint: string | undefined;
    if (!canBuild) {
      if (!hasBalance) {
        hint = "Insufficient resources";
      } else if (!realmHasCapacity) {
        hint = "No building capacity";
      } else if (!hasEnoughPopulation) {
        hint = "Not enough population";
      } else if (!simpleModeAllowed) {
        hint = "Unavailable in labor cost mode";
      }
    }

    const iconDescriptor = iconResource ?? resource ?? label;

    return makeBuildingAction({
      suffix,
      label,
      icon,
      building,
      view: LeftView.ConstructionView,
      resource,
      iconComponent: createResourceIconComponent(iconDescriptor, !canBuild),
      disabled: !canBuild,
      hint,
    });
  };

  const realmResourceActions: ContextMenuAction[] = (realmInfo?.resources ?? [])
    .map((resourceId) => {
      const typedResourceId = resourceId as ResourcesIds;
      const building = getBuildingFromResource(typedResourceId);
      const resource = findResourceById(typedResourceId);

      if (!building || !resource) {
        return null;
      }

      const icon = resource.img ?? undefined;

       const requiresStandardCost =
         typedResourceId === ResourcesIds.Dragonhide ||
         typedResourceId === ResourcesIds.Mithral ||
         typedResourceId === ResourcesIds.Adamantine;

      return createActionWithAvailability({
        suffix: `resource-${resourceId}`,
        label: resource.trait,
        icon,
        building,
        resource: typedResourceId,
        iconResource: typedResourceId,
        requiresStandardCost,
      });
    })
    .filter((action): action is ContextMenuAction => action !== null);

  const economicActions: ContextMenuAction[] = [
    {
      suffix: "economic-farm",
      label: "Farm",
      building: BuildingType.ResourceWheat,
      resource: ResourcesIds.Wheat,
      iconResource: ResourcesIds.Wheat,
    },
    {
      suffix: "economic-workers-hut",
      label: "Workers Hut",
      building: BuildingType.WorkersHut,
      iconResource: ResourcesIds.Labor,
      requiresCapacity: false,
      requiresPopulation: false,
    },
    {
      suffix: "economic-storehouse",
      label: "Storehouse",
      building: BuildingType.Storehouse,
      iconResource: "Silo",
    },
    {
      suffix: "economic-market",
      label: "Market",
      building: BuildingType.ResourceDonkey,
      resource: ResourcesIds.Donkey,
      iconResource: ResourcesIds.Donkey,
    },
  ]
    .map((config) => createActionWithAvailability(config))
    .filter((action): action is ContextMenuAction => action !== null);

  const militaryTierActions: ContextMenuAction[] = militaryTierConfig.map(({ suffix, label, units }) => {
    const tierNumber = suffix.match(/\d+/)?.[0];
    const romanMatch = label.match(/Tier\s+(I{1,3})/i);
    const fromRoman = romanMatch ? romanToNumber[romanMatch[1].toUpperCase()] : undefined;
    const tierLabel = tierNumber ? `T${tierNumber}` : fromRoman ? `T${fromRoman}` : label.replace(/Tier\s+/i, "T");
    const requiresStandardMode = suffix !== "tier-1";
    const tierDisabled = requiresStandardMode && simpleCostEnabled;

    return {
      id: `structure-${idString}-military-${suffix}`,
      label,
      iconComponent: createTierIconComponent(tierLabel),
      childTitle: `${label} Units`,
      childSubtitle: `Realm ${idString}`,
      onSelect: () => {},
      disabled: tierDisabled,
      hint: tierDisabled ? "Unavailable in labor cost mode" : undefined,
      children: units
        .map(({ label: unitLabel, building, resource }) => {
          const resourceInfo = findResourceById(resource);
          const iconResource = resourceInfo?.trait ?? ResourcesIds[resource];

          return createActionWithAvailability({
            suffix: `military-${suffix}-${toSlug(unitLabel)}`,
            label: unitLabel,
            icon: resourceInfo?.img ?? undefined,
            building,
            resource,
            iconResource,
            requiresStandardCost: requiresStandardMode,
          });
        })
        .filter((action): action is ContextMenuAction => action !== null),
    };
  });

  const childActionGroupSizes = [
    realmResourceActions.length,
    economicActions.length,
    ...militaryTierActions.map((action) => action.children?.length ?? 0),
  ];

  const maxChildActionCount = childActionGroupSizes.reduce((max, count) => Math.max(max, count), 0);

  const radialOptions: ContextMenuRadialOptions = {
    ...CONTEXT_MENU_CONFIG.radial,
    maxActions: Math.max(CONTEXT_MENU_CONFIG.radial?.maxActions ?? 8, maxChildActionCount),
  };

  const constructionCategories: ContextMenuAction[] = [
    {
      id: `structure-${idString}-construction-resources`,
      label: "Resource Buildings",
      icon: "/image-icons/resources.png",
      childTitle: "Resource Buildings",
      childSubtitle: `Realm ${idString}`,
      onSelect: () => {},
      children: realmResourceActions.length > 0 ? realmResourceActions : undefined,
      disabled: realmResourceActions.length === 0,
    },
    {
      id: `structure-${idString}-construction-economic`,
      label: "Economic Buildings",
      icon: "/image-icons/construction.png",
      childTitle: "Economic Buildings",
      childSubtitle: `Realm ${idString}`,
      onSelect: () => {},
      children: economicActions,
    },
    {
      id: `structure-${idString}-construction-military`,
      label: "Military Buildings",
      icon: "/image-icons/military.png",
      childTitle: "Select Tier",
      childSubtitle: `Realm ${idString}`,
      onSelect: () => {},
      children: militaryTierActions,
    },
  ].filter((action) => !action.children || action.children.length > 0);

  const constructionAction: ContextMenuAction = {
    id: `structure-${idString}-construction`,
    label: "Construction",
    icon: "/image-icons/construction.png",
    childTitle: "Select Building Category",
    childSubtitle: `Realm ${idString}`,
    children: constructionCategories,
    onSelect: () => {},
  };

  return {
    constructionAction,
    radialOptions,
  };
};
