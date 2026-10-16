import { iconUrl, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { LeftView } from "@/types";
import { getGameModeConfig } from "@/config/game-modes";
import { ContextMenuAction } from "@/types/context-menu";
import type { ReactNode } from "react";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { resolveConstructionBuildability } from "@bibliothecadao/eternum/automation";
import type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";
import { getRealmInfo, configManager, getEntityName, getIsBlitz, resolveUseSimpleCost } from "@bibliothecadao/eternum";
import {
  BuildingType,
  HexEntityInfo,
  ResourcesIds,
  findResourceById,
  getBuildingFromResource,
} from "@bibliothecadao/types";
import { getPlayerName } from "@/services/identity/player-profiles";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

type Store = SetupResult["store"];

interface CreateConstructionMenuParams {
  structure: HexEntityInfo;
  store: Store;
  simpleCostEnabled: boolean;
  selectConstructionBuilding: (building: BuildingType, view: LeftView, resource?: ResourcesIds) => void;
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

const createResourceIconComponent = (meaning: IconMeaning, isDisabled: boolean = false): ReactNode => (
  <Icon
    name={meaning}
    size={24}
    className={`pointer-events-none h-4 w-4 md:h-6 md:w-6 ${isDisabled ? "opacity-40 grayscale" : ""}`}
  />
);

const createTierIconComponent = (tierLabel: string): ReactNode => (
  <span className="pointer-events-none text-xs font-semibold uppercase text-gold">{tierLabel}</span>
);

export const createConstructionMenu = ({
  structure,
  store,
  simpleCostEnabled: requestedSimpleCost,
  selectConstructionBuilding,
}: CreateConstructionMenuParams): ContextMenuAction => {
  const structureId = BigInt(structure.id);
  const idString = structureId.toString();
  const structureEntityId = safeInteger(structureId);
  const mode = getGameModeConfig();
  const simpleCostEnabled = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);

  const realmInfo = getRealmInfo(structureEntityId, store, getPlayerName);
  const structureName = getEntityName(structureEntityId, store, getIsBlitz()) ?? "Realm";

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
    iconComponent?: ReactNode;
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
  }: {
    suffix: string;
    label: string;
    icon?: string;
    building: BuildingType;
    resource?: ResourcesIds;
    iconResource: IconMeaning;
  }): ContextMenuAction | null => {
    const buildability = resolveConstructionBuildability({
      entityId: structureEntityId,
      buildingType: building,
      useSimpleCost: simpleCostEnabled,
      store,
      realm: realmInfo,
      mode,
    });
    const canBuild = buildability.canSubmit;

    return makeBuildingAction({
      suffix,
      label,
      icon,
      building,
      view: LeftView.ConstructionView,
      resource,
      iconComponent: createResourceIconComponent(iconResource, !canBuild),
      disabled: !canBuild,
      hint: buildability.reason,
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

      const icon = iconUrl(resourceMeaning(typedResourceId));

      return createActionWithAvailability({
        suffix: `resource-${resourceId}`,
        label: resource.trait,
        icon,
        building,
        resource: typedResourceId,
        iconResource: resourceMeaning(typedResourceId),
      });
    })
    .filter((action): action is ContextMenuAction => action !== null);

  const economicActions: ContextMenuAction[] = (
    [
      {
        suffix: "economic-farm",
        label: "Farm",
        building: BuildingType.ResourceWheat,
        resource: ResourcesIds.Wheat,
        iconResource: resourceMeaning(ResourcesIds.Wheat),
      },
      {
        suffix: "economic-workers-hut",
        label: "Workers Hut",
        building: BuildingType.WorkersHut,
        iconResource: resourceMeaning(ResourcesIds.Labor),
      },
      {
        suffix: "economic-storehouse",
        label: "Storehouse",
        building: BuildingType.Storehouse,
        iconResource: "granary",
      },
      {
        suffix: "economic-market",
        label: "Market",
        building: BuildingType.ResourceDonkey,
        resource: ResourcesIds.Donkey,
        iconResource: resourceMeaning(ResourcesIds.Donkey),
      },
    ] satisfies Parameters<typeof createActionWithAvailability>[0][]
  )
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
      childSubtitle: structureName,
      onSelect: () => {},
      disabled: tierDisabled,
      hint: tierDisabled ? "Unavailable in labor cost mode" : undefined,
      children: units
        .map(({ label: unitLabel, building, resource }) => {
          return createActionWithAvailability({
            suffix: `military-${suffix}-${toSlug(unitLabel)}`,
            label: unitLabel,
            icon: iconUrl(resourceMeaning(resource)),
            building,
            resource,
            iconResource: resourceMeaning(resource),
          });
        })
        .filter((action): action is ContextMenuAction => action !== null),
    };
  });

  const constructionCategories: ContextMenuAction[] = [
    {
      id: `structure-${idString}-construction-resources`,
      label: "Resource Buildings",
      icon: iconUrl("resources"),
      childTitle: "Resource Buildings",
      childSubtitle: structureName,
      onSelect: () => {},
      children: realmResourceActions.length > 0 ? realmResourceActions : undefined,
      disabled: realmResourceActions.length === 0,
    },
    {
      id: `structure-${idString}-construction-economic`,
      label: "Economic Buildings",
      icon: iconUrl("build"),
      childTitle: "Economic Buildings",
      childSubtitle: structureName,
      onSelect: () => {},
      children: economicActions,
    },
    {
      id: `structure-${idString}-construction-military`,
      label: "Military Buildings",
      icon: iconUrl("military"),
      childTitle: "Select Tier",
      childSubtitle: structureName,
      onSelect: () => {},
      children: militaryTierActions,
    },
  ].filter((action) => !action.children || action.children.length > 0);

  const constructionAction: ContextMenuAction = {
    id: `structure-${idString}-construction`,
    label: "Construction",
    icon: iconUrl("build"),
    childTitle: "Select Building Category",
    childSubtitle: structureName,
    children: constructionCategories,
    onSelect: () => {},
  };

  return constructionAction;
};
