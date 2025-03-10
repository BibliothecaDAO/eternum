import { Position } from "@/types/position";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { DisplayedAccess, HyperstructurePanel } from "@/ui/components/hyperstructures/hyperstructure-panel";
import { EntityList } from "@/ui/components/list/entity-list";
import { NavigateToPositionIcon } from "@/ui/components/military/army-chip";
import { Checkbox } from "@/ui/elements/checkbox";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { ViewOnMapIcon } from "@/ui/elements/view-on-map-icon";
import { currencyIntlFormat } from "@/ui/utils/utils";
import {
  ContractAddress,
  getAddressFromEntity,
  getAddressNameFromEntity,
  getGuildFromPlayerAddress,
  ID,
  LeaderboardManager,
  MERCENARIES,
} from "@bibliothecadao/eternum";
import { useDojo, useHyperstructureProgress, useHyperstructures } from "@bibliothecadao/react";
import { ArrowRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Tabs } from "../../elements/tab";

export const WorldStructuresMenu = ({ className }: { className?: string }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const [selectedTab, setSelectedTab] = useState(0);
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const hyperstructures = useHyperstructures();

  const myHyperstructures = useMemo(
    () =>
      LeaderboardManager.instance(components).getHyperstructuresWithContributionsFromPlayer(
        ContractAddress(account.address),
      ),
    [components, account.address],
  );

  const renderExtraContent = useCallback(
    (entityId: ID, type: "hyperstructure") => {
      const entity = hyperstructures.find((e) => e?.entity_id === entityId);
      if (!entity) return null;

      return (
        <HyperStructureExtraContent
          hyperstructureEntityId={entity.entity_id!}
          x={entity.position.x}
          y={entity.position.y}
        />
      );
    },
    [hyperstructures],
  );

  const renderEntityHeader = useCallback(
    (entityId: ID, type: "hyperstructure") => {
      const entity = hyperstructures.find((e) => e?.entity_id === entityId);
      return entity ? <EntityHeader entity={entity} /> : null;
    },
    [hyperstructures],
  );

  const tabs = useMemo(
    () => [
      {
        key: "Hyperstructures",
        label: "Hyperstructures",
        component: (
          <>
            <FilterCheckbox showOnlyMine={showOnlyMine} setShowOnlyMine={setShowOnlyMine} />
            <EntityList
              title="Hyperstructures"
              panel={({ entity }) => <HyperstructurePanel entity={entity} />}
              entityHeader={(id: any) => renderEntityHeader(id, "hyperstructure")}
              entityContent={(id: any) => renderExtraContent(id, "hyperstructure")}
              chunkSize={10}
              list={hyperstructures
                .filter((h) => h?.base?.created_at)
                .sort((a, b) => Number(a?.entity_id) - Number(b?.entity_id))
                .map((h) => ({
                  ...h,
                  id: h?.entity_id,
                  position: { x: h?.position.x, y: h?.position.y },
                }))}
              filterEntityIds={showOnlyMine ? Array.from(myHyperstructures) : undefined}
            />
          </>
        ),
      },
    ],
    [selectedTab, hyperstructures, showOnlyMine, account.address, myHyperstructures],
  );

  return (
    <>
      <HintModalButton className="absolute top-1 right-1" section={HintSection.WorldStructures} />
      <Tabs selectedIndex={selectedTab} onChange={setSelectedTab} variant="default">
        <Tabs.List>
          {tabs.map((tab, index) => (
            <Tabs.Tab key={index}>
              <div className="flex group relative flex-col items-center">
                <div>{tab.label}</div>
              </div>
            </Tabs.Tab>
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

const FilterCheckbox = ({
  showOnlyMine,
  setShowOnlyMine,
}: {
  showOnlyMine: boolean;
  setShowOnlyMine: (show: boolean) => void;
}) => (
  <div className="px-2 pb-2">
    <label className="flex items-center space-x-1 text-xs">
      <Checkbox enabled={showOnlyMine} onClick={() => setShowOnlyMine(!showOnlyMine)} />
      <span>Show only mine</span>
    </label>
  </div>
);

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
  const {
    setup: { components },
  } = useDojo();

  const structureOwner = useMemo(() => {
    const ownerName = getAddressNameFromEntity(entityId, components);
    const address = getAddressFromEntity(entityId, components);
    const guildName = getGuildFromPlayerAddress(address || 0n, components)?.name;
    return { name: ownerName, guildName };
  }, [entityId]);

  return (
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Owner:</span>
        <span className="font-medium">{structureOwner?.guildName || structureOwner?.name || MERCENARIES}</span>
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
    setup: { components },
    account: { account },
  } = useDojo();

  const progress = useHyperstructureProgress(hyperstructureEntityId);
  const latestChangeEvent = LeaderboardManager.instance(components).getCurrentCoOwners(hyperstructureEntityId);
  const needTosetCoOwners = !latestChangeEvent && progress.percentage === 100;
  const shares =
    LeaderboardManager.instance(components).getAddressShares(
      ContractAddress(account.address),
      hyperstructureEntityId,
    ) || 0;

  return (
    <BaseStructureExtraContent x={x} y={y} entityId={hyperstructureEntityId}>
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Progress:</span>
        <span className="font-medium">{`${progress.percentage}%`}</span>
        {needTosetCoOwners && <div className="text-xs text-red animate-pulse">Co-owners not set</div>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Shares:</span>
        <span className="font-medium">{currencyIntlFormat(shares * 100, 0)}%</span>
      </div>
    </BaseStructureExtraContent>
  );
};

const EntityHeader = ({ entity }: { entity: any }) => {
  const position = { x: entity.x, y: entity.y };
  const access = entity?.access ? DisplayedAccess[entity.access as keyof typeof DisplayedAccess] : undefined;

  const getAccessStyle = (access?: string) => {
    if (!access) return "";
    const styles = {
      Public: "text-green border border-green",
      Private: "text-red border border-red",
      "Tribe Only": "text-gold border border-gold",
    };
    return styles[access as keyof typeof styles] || "";
  };

  return (
    <div className="flex flex-row justify-between items-center">
      <div className="flex flex-row space-x-5 items-center">
        <div className="flex flex-row items-center gap-2">
          <h5 className="font-semibold text-gold">{entity.name}</h5>
          {access && (
            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${getAccessStyle(access)}`}>{access}</span>
          )}
          <div className="flex flex-row">
            <ViewOnMapIcon className="my-auto" position={new Position(position)} />
            <NavigateToPositionIcon className="h-6 w-6" position={new Position(position)} />
          </div>
        </div>
      </div>
      <ArrowRight className="w-2 fill-current" />
    </div>
  );
};
