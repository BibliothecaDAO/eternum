import { ReactComponent as ArrowLeft } from "@/assets/icons/common/arrow-left.svg";
import { ReactComponent as MessageSvg } from "@/assets/icons/common/message.svg";
import { Position as PositionType } from "@/types/position";
import { NavigateToPositionIcon } from "@/ui/components/military/army-chip";
import { RealmResourcesIO } from "@/ui/components/resources/realm-resources-io";
import Button from "@/ui/elements/button";
import { ViewOnMapIcon } from "@/ui/elements/view-on-map-icon";
import { getAddressName, getEntityName, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { MapPin } from "lucide-react";
import { useMemo } from "react";
import { useChatStore } from "../chat/use-chat-store";
import { getMessageKey } from "../chat/utils";

// Define a type guard to filter out undefined structures
function isStructureDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export const MessageIcon = ({
  playerName,
  selectedPlayer,
}: {
  playerName: string | undefined;
  selectedPlayer: ContractAddress;
}) => {
  const {
    account: { account },
  } = useDojo();
  const addTab = useChatStore((state) => state.addTab);

  const handleClick = () => {
    if (!playerName) return;
    addTab({
      name: playerName,
      key: getMessageKey(account.address, selectedPlayer),
      address: toHexString(selectedPlayer),
      displayed: true,
      lastSeen: new Date(),
    });
  };

  return (
    <MessageSvg
      onClick={handleClick}
      className="h-5 w-5 fill-gold hover:fill-gold/50 hover:animate-pulse duration-300 transition-all cursor-pointer"
    />
  );
};

export const PlayerId = ({
  selectedPlayer,
  selectedGuild,
  back,
}: {
  selectedPlayer: ContractAddress;
  selectedGuild?: ContractAddress;
  back?: () => void;
}) => {
  const {
    setup: { components },
  } = useDojo();

  const { Structure } = components;

  const playerName = useMemo(() => {
    if (!selectedPlayer) return;

    const playerName = getAddressName(selectedPlayer, components);
    return playerName;
  }, [selectedPlayer]);

  const playerStructures = useMemo(() => {
    if (!selectedPlayer) return;

    const structuresEntityIds = runQuery([Has(Structure), HasValue(Structure, { owner: selectedPlayer })]);
    const structures = Array.from(structuresEntityIds)
      .map((entityId) => {
        const structure = getComponentValue(Structure, entityId);
        if (!structure) return undefined;

        const position = new PositionType({ x: structure.base.coord_x, y: structure.base.coord_y });

        const structureName = getEntityName(structure.entity_id, components, true);
        return {
          structureName,
          ...structure,
          position,
        };
      })
      .filter(isStructureDefined); // Use the type guard here
    return structures;
  }, [selectedPlayer, Structure, components]);

  // Count structure types
  const structureCounts = useMemo(() => {
    if (!playerStructures) return { realms: 0, mines: 0, hyperstructures: 0 };

    return playerStructures.reduce(
      (acc, structure) => {
        if (!structure) return acc;

        if (structure.base.category === StructureType.Realm) {
          acc.realms++;
        } else if (structure.base.category === StructureType.FragmentMine) {
          acc.mines++;
        } else if (structure.base.category === StructureType.Hyperstructure) {
          acc.hyperstructures++;
        }

        return acc;
      },
      { realms: 0, mines: 0, hyperstructures: 0 },
    );
  }, [playerStructures]);

  return (
    <div className="pointer-events-auto h-full flex flex-col">
      {!!selectedGuild && (
        <Button variant={"outline"} className={"mt-2 ml-2"} onClick={back}>
          <ArrowLeft className="w-2 mr-2" /> Back
        </Button>
      )}

      <div className="p-4 flex-1 flex flex-col overflow-hidden">
        {/* Player header */}
        <div className="flex flex-row gap-4 border-gold/20">
          <AvatarImage address={toHexString(selectedPlayer!)} />

          <div className="flex flex-col justify-between flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className=" items-center gap-3 rounded-lg shadow-md flex-1">
                <h4 className=" truncate">{playerName || "No player selected"}</h4>

                <div className=" text-gold">{structureCounts.realms} Realms</div>
              </div>
            </div>
          </div>
        </div>

        {/* Structure counts */}
        {playerStructures && playerStructures.length > 0 && (
          <div className="grid grid-cols-3 gap-2 my-2">
            <div className="flex flex-col col-span-1 items-center p-1  rounded-md border border-gold/10">
              <span className="text-2xl font-bold text-gold">{structureCounts.mines}</span>
              <span className="text-xs text-gold/80 h6">Mines</span>
            </div>
            <div className="flex flex-col col-span-2 items-center p-1  rounded-md border border-gold/10">
              <span className="text-2xl font-bold text-gold">{structureCounts.hyperstructures}</span>
              <span className="text-xs text-gold/80 h6">Hyperstructures</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
          <div className="grid grid-cols-1 gap-3">
            {playerStructures &&
              playerStructures.map((structure) => {
                let structureSpecificElement: JSX.Element | null;
                if (structure.base.category === StructureType.Realm) {
                  structureSpecificElement = (
                    <div key={`resources-${structure.entity_id}`}>
                      <RealmResourcesIO
                        className="w-full font-normal"
                        titleClassName="font-normal text-sm"
                        realmEntityId={structure.entity_id}
                      />
                    </div>
                  );
                } else {
                  structureSpecificElement = null;
                }

                return (
                  <div
                    key={structure.entity_id}
                    className="flex flex-col gap-2 border border-gold/20 p-3 rounded-md bg-brown/5 hover:bg-brown/10 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <h6 className="truncate flex-1">{structure.structureName}</h6>
                      <div className="flex items-center gap-1">
                        <NavigateToPositionIcon className="w-5 h-5" position={structure.position} />
                        <ViewOnMapIcon className="w-4 h-4" position={structure.position} />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gold/70 mb-2">
                      <MapPin size={12} />
                      <span>
                        Position: {structure.position.getNormalized().x}, {structure.position.getNormalized().y}
                      </span>
                    </div>

                    {structureSpecificElement}
                  </div>
                );
              })}

            {(!playerStructures || playerStructures.length === 0) && (
              <div className="col-span-2 text-center p-4 text-gold/50 italic">No properties found for this player</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AvatarImage = ({ address }: { address: string }) => {
  const randomAvatarIndex = ((parseInt(address.slice(0, 8), 16) % 7) + 1).toString().padStart(2, "0");
  const imgSource = `./images/avatars/${randomAvatarIndex}.png`;

  return (
    <div className="w-24 h-24 rounded-md overflow-hidden border-2 border-gold/20 shadow-lg bg-brown/30">
      <img className="h-full w-full object-cover" src={imgSource} alt="Player avatar" />
    </div>
  );
};
