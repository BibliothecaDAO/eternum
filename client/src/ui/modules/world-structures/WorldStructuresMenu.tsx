import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { getArmiesByPosition } from "@/hooks/helpers/useArmies";
import { useGetHyperstructuresWithContributionsFromPlayer } from "@/hooks/helpers/useContributions";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useFragmentMines } from "@/hooks/helpers/useFragmentMines";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import { useHyperstructureProgress, useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { FragmentMinePanel } from "@/ui/components/fragmentMines/FragmentMinePanel";
import { HintSection } from "@/ui/components/hints/HintModal";
import { DisplayedAccess, HyperstructurePanel } from "@/ui/components/hyperstructures/HyperstructurePanel";
import { EntityList } from "@/ui/components/list/EntityList";
import { NavigateToPositionIcon } from "@/ui/components/military/ArmyChip";
import { ViewOnMapIcon } from "@/ui/components/military/ArmyManagementCard";
import { Checkbox } from "@/ui/elements/Checkbox";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat, currencyIntlFormat, divideByPrecision, getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  BattleSide,
  ContractAddress,
  HYPERSTRUCTURE_CONFIG_ID,
  ID,
  ResourcesIds,
  findResourceById,
} from "@bibliothecadao/eternum";
import { Metadata, getComponentValue } from "@dojoengine/recs";
import { S } from "@dojoengine/recs/dist/types-3444e4c1";
import { getEntities } from "@dojoengine/state";
import { ToriiClient } from "@dojoengine/torii-wasm";
import { ArrowRight } from "lucide-react";
import { Component, useCallback, useEffect, useMemo, useState } from "react";
import { Tabs } from "../../elements/tab";

export const WorldStructuresMenu = ({ className }: { className?: string }) => {
  const dojo = useDojo();
  const {
    account: { account },
  } = dojo;

  useEffect(() => {
    const fetch = async () => {
      try {
        await fetchHyperstructureData(dojo.network.toriiClient, dojo.network.contractComponents as any);
      } catch (error) {
        console.error("Fetch failed", error);
      }
    };

    fetch();
  }, []);

  const [selectedTab, setSelectedTab] = useState(0);
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const { hyperstructures } = useHyperstructures();
  const { fragmentMines } = useFragmentMines();

  const myHyperstructures = useGetHyperstructuresWithContributionsFromPlayer();
  const hyperstructureExtraContent = useCallback(
    (entityId: any) => {
      const hyperstructure = hyperstructures.find((hyperstructure) => hyperstructure.entity_id === entityId);
      if (!hyperstructure) return null;
      return (
        <HyperStructureExtraContent
          hyperstructureEntityId={hyperstructure.entity_id!}
          x={hyperstructure.x!}
          y={hyperstructure.y!}
        />
      );
    },
    [hyperstructures],
  );

  const fragmentMineExtraContent = useCallback(
    (entityId: any) => {
      const fragmentMine = fragmentMines.find((fragmentMine) => fragmentMine.entity_id === entityId);
      if (!fragmentMine) return null;

      return <FragmentMineExtraContent x={Number(fragmentMine.x!)} y={Number(fragmentMine.y!)} entityId={entityId!} />;
    },
    [fragmentMines],
  );

  const hyperstructureEntityHeader = useCallback(
    (entityId: any) => {
      const entity = hyperstructures.find((hyperstructure) => hyperstructure.entity_id === entityId);

      if (!entity) return null;

      return <EntityHeader entity={entity} />;
    },
    [hyperstructures],
  );

  const fragmentMineEntityHeader = useCallback(
    (entityId: any) => {
      const entity = fragmentMines.find((fragmentMine) => fragmentMine.entity_id === entityId);
      if (!entity) return null;

      return <EntityHeader entity={entity} />;
    },
    [fragmentMines],
  );

  const tabs = useMemo(
    () => [
      {
        key: "Hyperstructures",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Hyperstructures</div>
          </div>
        ),
        component: (
          <>
            <div className="px-2 pb-2">
              <label className="flex items-center space-x-1 text-xs">
                <Checkbox enabled={showOnlyMine} onClick={() => setShowOnlyMine(!showOnlyMine)} />
                <span>Show only mine</span>
              </label>
            </div>
            <EntityList
              title="Hyperstructures"
              panel={({ entity }) => <HyperstructurePanel entity={entity} />}
              entityHeader={hyperstructureEntityHeader}
              entityContent={hyperstructureExtraContent}
              list={hyperstructures
                .filter((hyperstructure) => hyperstructure.created_at)
                .sort((a, b) => Number(a.entity_id) - Number(b.entity_id))
                .map((hyperstructure) => ({
                  id: hyperstructure.entity_id,
                  position: { x: hyperstructure.x, y: hyperstructure.y },
                  ...hyperstructure,
                }))}
              filterEntityIds={showOnlyMine ? Array.from(myHyperstructures()) : undefined}
            />
          </>
        ),
      },
      {
        key: "Mines",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Mines</div>
          </div>
        ),
        component: (
          <>
            <div className="px-2 pb-2">
              <label className="flex items-center space-x-1 text-xs">
                <Checkbox enabled={showOnlyMine} onClick={() => setShowOnlyMine(!showOnlyMine)} />
                <span>Show only mine</span>
              </label>
            </div>
            <EntityList
              title="FragmentMines"
              panel={({ entity }) => <FragmentMinePanel entity={entity} />}
              entityHeader={fragmentMineEntityHeader}
              entityContent={fragmentMineExtraContent}
              list={fragmentMines
                .sort((a, b) => Number(a.entity_id) - Number(b.entity_id))
                .map((fragmentMine) => ({
                  id: fragmentMine.entity_id,
                  position: { x: fragmentMine.x, y: fragmentMine.y },
                  ...fragmentMine,
                }))}
              filterEntityIds={
                showOnlyMine
                  ? (fragmentMines
                      .filter((mine) => {
                        return mine.owner === account.address;
                      })
                      .map((mine) => mine.entity_id) as ID[])
                  : undefined
              }
            />
          </>
        ),
      },
    ],
    [selectedTab, hyperstructures, fragmentMines],
  );

  return (
    <>
      <HintModalButton className="absolute top-1 right-1" section={HintSection.WorldStructures} />
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: number) => setSelectedTab(index)}
        variant="default"
        className=""
      >
        <Tabs.List>
          {tabs.map((tab, index) => (
            <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panels className="overflow-hidden">
          {tabs.map((tab, index) => (
            <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </>
  );
};

const BaseStructureExtraContent = ({
  x,
  y,
  entityId,
  children,
}: {
  x: number;
  y: number;
  entityId: ID;
  children: React.ReactNode;
}) => {
  const { getGuildFromPlayerAddress } = useGuilds();
  const { getAddressNameFromEntity, getPlayerAddressFromEntity } = useEntitiesUtils();
  const getArmies = getArmiesByPosition();

  const armies = useMemo(() => getArmies({ x, y }), [x, y]);

  const structureOwner = useMemo(() => {
    const ownerName = getAddressNameFromEntity(entityId);
    const address = getPlayerAddressFromEntity(entityId);
    const guildName = getGuildFromPlayerAddress(address || 0n)?.name;
    return {
      name: ownerName,
      guildName,
    };
  }, []);

  const defensiveArmy = useMemo(() => {
    const army = armies.find((army) => army.protectee?.protectee_id);
    const ownerName = getAddressNameFromEntity(army?.entity_id || 0);
    const guildName = getGuildFromPlayerAddress(army?.owner?.address || 0n)?.name;
    return {
      totalTroops:
        (army?.troops?.knight_count || 0n) +
        (army?.troops?.paladin_count || 0n) +
        (army?.troops?.crossbowman_count || 0n),
      army,
      name: ownerName,
      guildName,
    };
  }, [armies]);

  const attackingArmy = useMemo(() => {
    const army = armies.find(
      (army) => army.battle_side === BattleSide[BattleSide.Attack] && army.battle_id === defensiveArmy.army?.battle_id,
    );
    if (!army) return;
    const ownerName = getAddressNameFromEntity(army?.entity_id || 0);
    const guildName = getGuildFromPlayerAddress(army?.owner?.address || 0n)?.name;
    return {
      totalTroops:
        (army?.troops?.knight_count || 0n) +
        (army?.troops?.paladin_count || 0n) +
        (army?.troops?.crossbowman_count || 0n),
      army,
      name: ownerName,
      guildName,
    };
  }, [armies]);

  return (
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Owner:</span>
        <span className="font-medium">{structureOwner?.guildName || structureOwner?.name || "Mercenaries"}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Defense:</span>
        <span className="font-medium">{currencyFormat(Number(defensiveArmy.totalTroops), 0)}</span>
      </div>
      <div className="flex items-center gap-2 col-span-2">
        <span className="text-gold/80">Battle:</span>
        <span className="font-medium">
          {attackingArmy ? `${attackingArmy?.guildName || attackingArmy?.name || "Mercenaries"}⚔` : "None"}
        </span>
      </div>
      {children}
    </div>
  );
};

const HyperStructureExtraContent = ({
  hyperstructureEntityId,
  x,
  y,
}: {
  hyperstructureEntityId: ID;
  x: number;
  y: number;
}) => {
  const dojo = useDojo();
  const {
    account: { account },
  } = dojo;

  const progress = useHyperstructureProgress(hyperstructureEntityId);

  const latestChangeEvent = LeaderboardManager.instance(dojo).getCurrentCoOwners(hyperstructureEntityId);

  const needTosetCoOwners = !latestChangeEvent && progress.percentage === 100;

  return (
    <BaseStructureExtraContent x={x} y={y} entityId={hyperstructureEntityId}>
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Progress:</span>
        <span className="font-medium">{`${progress.percentage}%`}</span>
        {needTosetCoOwners && <div className="text-xs text-red animate-pulse">Co-owners not set</div>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Shares:</span>
        <span className="font-medium">
          {currencyIntlFormat(
            (LeaderboardManager.instance(dojo).getAddressShares(
              ContractAddress(account.address),
              hyperstructureEntityId,
            ) || 0) * 100,
            0,
          )}
          %
        </span>
      </div>
    </BaseStructureExtraContent>
  );
};

const FragmentMineExtraContent = ({ x, y, entityId }: { x: number; y: number; entityId: ID }) => {
  const { getBalance } = useResourceBalance();
  const dynamicResources = getBalance(entityId, ResourcesIds.AncientFragment);
  const trait = useMemo(() => findResourceById(ResourcesIds.AncientFragment)?.trait, []);

  return (
    <BaseStructureExtraContent x={x} y={y} entityId={entityId}>
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Balance:</span>
        <span className="font-medium flex items-center">
          {Intl.NumberFormat("en-US", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(divideByPrecision(dynamicResources.balance || 0))}
          <ResourceIcon className="ml-1" isLabor={false} withTooltip={false} resource={trait || ""} size={"xs"} />
        </span>
      </div>
    </BaseStructureExtraContent>
  );
};

const EntityHeader = ({ entity }: { entity: any }) => {
  const position = { x: entity.x, y: entity.y };

  const access = entity?.access ? DisplayedAccess[entity.access as keyof typeof DisplayedAccess] : undefined;

  return (
    <div className="flex flex-row justify-between items-center">
      <div className="flex flex-row space-x-5 items-center">
        <div className="flex flex-row items-center gap-2">
          <h5 className="font-semibold text-gold">{entity.name}</h5>
          {access && (
            <span
              className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                access === "Public"
                  ? "text-green border border-green"
                  : access === "Private"
                    ? "text-red border border-red"
                    : access === "Tribe Only"
                      ? "text-gold border border-gold"
                      : ""
              }`}
            >
              {access}
            </span>
          )}
          <div className="flex flex-row ">
            <ViewOnMapIcon className={"my-auto"} position={position} />
            <NavigateToPositionIcon className="h-6 w-6" position={position} />
          </div>
        </div>
      </div>
      <ArrowRight className="w-2 fill-current" />
    </div>
  );
};

const fetchHyperstructureData = async (client: ToriiClient, components: Component<S, Metadata, undefined>[]) => {
  const hyperstructureConfig = getComponentValue(
    (components as any).HyperstructureResourceConfig,
    getEntityIdFromKeys([HYPERSTRUCTURE_CONFIG_ID, 4n]),
  );

  if (hyperstructureConfig) {
    return;
  }

  await getEntities(
    client,
    {
      Composite: {
        operator: "Or",
        clauses: [
          {
            Keys: {
              keys: [undefined, undefined],
              pattern_matching: "VariableLen",
              models: ["s0_eternum-Contribution"],
            },
          },
          {
            Keys: {
              keys: [undefined, undefined, undefined],
              pattern_matching: "VariableLen",
              models: ["s0_eternum-Epoch", "s0_eternum-Progress"],
            },
          },
          {
            Keys: {
              keys: [HYPERSTRUCTURE_CONFIG_ID.toString(), undefined],
              pattern_matching: "VariableLen",
              models: [],
            },
          },
        ],
      },
    },
    components as any,
    40_000,
    false,
  );
};
