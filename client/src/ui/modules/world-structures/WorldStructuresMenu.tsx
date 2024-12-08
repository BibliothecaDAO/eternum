import { useDojo } from "@/hooks/context/DojoContext";
import { EntityList } from "@/ui/components/list/EntityList";
import { currencyFormat, currencyIntlFormat, divideByPrecision } from "@/ui/utils/utils";
import { useMemo, useState } from "react";
import { Tabs } from "../../elements/tab";

import { FragmentMinePanel } from "@/ui/components/fragmentMines/FragmentMinePanel";
import { HyperstructurePanel } from "@/ui/components/hyperstructures/HyperstructurePanel";

import { useFragmentMines } from "@/hooks/helpers/useFragmentMines";
import { useHyperstructureProgress, useHyperstructures } from "@/hooks/helpers/useHyperstructures";

import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { getArmiesByPosition } from "@/hooks/helpers/useArmies";
import { useGetHyperstructuresWithContributionsFromPlayer } from "@/hooks/helpers/useContributions";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { HintSection } from "@/ui/components/hints/HintModal";
import { Checkbox } from "@/ui/elements/Checkbox";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { BattleSide, ContractAddress, findResourceById, ID, ResourcesIds } from "@bibliothecadao/eternum";

export const WorldStructuresMenu = ({ className }: { className?: string }) => {
  const {
    account: { account },
  } = useDojo();

  const [selectedTab, setSelectedTab] = useState(0);
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const { hyperstructures } = useHyperstructures();
  const { fragmentMines } = useFragmentMines();

  const myHyperstructures = useGetHyperstructuresWithContributionsFromPlayer();

  const hyperstructureExtraContent = (entityId: any) => {
    const hyperstructure = hyperstructures.find((hyperstructure) => hyperstructure.entity_id === entityId);
    if (!hyperstructure) return null;
    return (
      <HyperStructureExtraContent
        hyperstructureEntityId={hyperstructure.entity_id!}
        x={hyperstructure.x!}
        y={hyperstructure.y!}
      />
    );
  };

  const fragmentMineExtraContent = (entityId: any) => {
    const fragmentMine = fragmentMines.find((fragmentMine) => fragmentMine.entity_id === entityId);
    if (!fragmentMine) return null;

    fragmentMine.production_rate;

    return <FragmentMineExtraContent x={Number(fragmentMine.x!)} y={Number(fragmentMine.y!)} entityId={entityId!} />;
  };

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
              entityContent={hyperstructureExtraContent}
              list={hyperstructures
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
              entityContent={fragmentMineExtraContent}
              list={fragmentMines
                .sort((a, b) => Number(a.entity_id) - Number(b.entity_id))
                .map((fragmentMine) => ({
                  id: fragmentMine.entity_id,
                  position: { x: fragmentMine.x, y: fragmentMine.y },
                  ...fragmentMine,
                }))}
              filterEntityIds={
                fragmentMines
                  .filter((mine) => {
                    mine.owner === account.address;
                  })
                  .map((mine) => mine.entity_id) as ID[]
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
  const {
    account: { account },
  } = useDojo();

  const progress = useHyperstructureProgress(hyperstructureEntityId);

  return (
    <BaseStructureExtraContent x={x} y={y} entityId={hyperstructureEntityId}>
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Progress:</span>
        <span className="font-medium">{`${progress.percentage}%`}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Shares:</span>
        <span className="font-medium">
          {currencyIntlFormat(
            (LeaderboardManager.instance().getAddressShares(ContractAddress(account.address), hyperstructureEntityId) ||
              0) * 100,
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
