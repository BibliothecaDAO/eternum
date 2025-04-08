import { Position } from "@/types/position";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { DisplayedAccess, HyperstructurePanel } from "@/ui/components/hyperstructures/hyperstructure-panel";
import { NavigateToPositionIcon } from "@/ui/components/military/army-chip";
import Button from "@/ui/elements/button";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { ViewOnMapIcon } from "@/ui/elements/view-on-map-icon";
import { currencyIntlFormat } from "@/ui/utils/utils";
import {
  ContractAddress,
  DUMMY_HYPERSTRUCTURE_ENTITY_ID,
  getAddressFromStructureEntity,
  getAddressNameFromEntity,
  getGuildFromPlayerAddress,
  LeaderboardManager,
  MERCENARIES,
} from "@bibliothecadao/eternum";
import { useDojo, useHyperstructureProgress, useHyperstructures } from "@bibliothecadao/react";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";

export const WorldStructuresMenu = ({ className }: { className?: string }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const hyperstructures = useHyperstructures();

  const myHyperstructures = useMemo(
    () =>
      LeaderboardManager.instance(components).getHyperstructuresWithContributionsFromPlayer(
        ContractAddress(account.address),
      ),
    [components, account.address],
  );

  const hyperstructuresList = useMemo(
    () =>
      hyperstructures
        .filter((h) => h?.base?.created_at)
        .sort((a, b) => Number(a?.entity_id) - Number(b?.entity_id))
        .map((h) => ({
          ...h,
          id: h?.entity_id,
          position: { x: h?.position.x, y: h?.position.y },
        })),
    [hyperstructures],
  );

  return (
    <div className={className}>
      <HintModalButton className="absolute top-1 right-1" section={HintSection.WorldStructures} />
      {selectedEntity ? (
        <div className="p-2">
          <Button className="mb-3" variant="default" size="xs" onClick={() => setSelectedEntity(null)}>
            {"<"} Back to Hyperstructures
          </Button>
          <HyperstructurePanel
            entity={hyperstructuresList.find((entity) => entity.entity_id === selectedEntity.entity_id)}
          />
        </div>
      ) : (
        <div className="p-2">
          <div>
            <ul>
              {hyperstructuresList.map((entity) => (
                <li
                  className={clsx("p-2 hover:bg-crimson/5 my-3 rounded border panel-wood", {
                    "animate-pulse pointer-events-none": entity.id === Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID),
                  })}
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity)}
                >
                  <div className="flex flex-col space-y-2">
                    <HyperstructureHeader id={{ id: entity.id }} hyperstructures={hyperstructures} />
                    <div>
                      <HyperstructureContent id={{ id: entity.id }} hyperstructures={hyperstructures} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

const HyperstructureHeader = ({ id, hyperstructures }: { id: { id: number | undefined }; hyperstructures: any[] }) => {
  const entity = hyperstructures.find((e) => e?.entity_id === id.id);
  if (!entity || id.id === undefined) return null;

  const position = { x: entity.x, y: entity.y };
  const access = entity?.access ? DisplayedAccess[entity.access as keyof typeof DisplayedAccess] : undefined;

  const accessStyles = {
    Public: "text-green border border-green",
    Private: "text-red border border-red",
    "Tribe Only": "text-gold border border-gold",
  };

  const accessStyle = access ? accessStyles[access as keyof typeof accessStyles] || "" : "";

  return (
    <div className="flex flex-row justify-between items-center">
      <div className="flex flex-row items-center gap-2">
        <h5 className="font-semibold text-gold">{entity.name}</h5>
        {access && <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${accessStyle}`}>{access}</span>}
        <div className="flex flex-row">
          <ViewOnMapIcon className="my-auto" position={new Position(position)} />
          <NavigateToPositionIcon className="h-6 w-6" position={new Position(position)} />
        </div>
      </div>
      <ArrowRight className="w-2 fill-current" />
    </div>
  );
};

const HyperstructureContent = ({ id, hyperstructures }: { id: { id: number | undefined }; hyperstructures: any[] }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const entity = hyperstructures.find((e) => e?.entity_id === id.id);
  if (!entity || id.id === undefined) return null;

  const idNumber = Number(id.id);
  const progress = useHyperstructureProgress(idNumber);
  const latestChangeEvent = LeaderboardManager.instance(components).getCurrentCoOwners(idNumber);
  const needTosetCoOwners = !latestChangeEvent && progress.percentage === 100;
  const shares =
    LeaderboardManager.instance(components).getPlayerShares(ContractAddress(account.address), idNumber) || 0;

  // Get owner information
  const ownerName = getAddressNameFromEntity(idNumber, components);
  const address = getAddressFromStructureEntity(idNumber, components);
  const guildName = getGuildFromPlayerAddress(address || 0n, components)?.name;

  return (
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Owner:</span>
        <span className="font-medium">{guildName || ownerName || MERCENARIES}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Progress:</span>
        <span className="font-medium">{progress.percentage}%</span>
        {needTosetCoOwners && <div className="text-xs text-red animate-pulse">Co-owners not set</div>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gold/80">Shares:</span>
        <span className="font-medium">{currencyIntlFormat(shares * 100, 0)}%</span>
      </div>
    </div>
  );
};
