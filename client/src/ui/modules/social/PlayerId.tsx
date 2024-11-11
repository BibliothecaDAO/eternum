import { ReactComponent as ArrowLeft } from "@/assets/icons/common/arrow-left.svg";
import { ReactComponent as MessageSvg } from "@/assets/icons/common/message.svg";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import useUIStore from "@/hooks/store/useUIStore";
import { Position as PositionType } from "@/types/Position";
import { NavigateToPositionIcon } from "@/ui/components/military/ArmyChip";
import { ViewOnMapIcon } from "@/ui/components/military/ArmyManagementCard";
import { RealmResourcesIO } from "@/ui/components/resources/RealmResourcesIO";
import Button from "@/ui/elements/Button";
import { formatTime, toHexString } from "@/ui/utils/utils";
import { ContractAddress, StructureType } from "@bibliothecadao/eternum";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useMemo } from "react";
import { useChatStore } from "../chat/ChatState";
import { getMessageKey } from "../chat/utils";

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
      className="h-4 w-4 fill-gold hover:fill-gold/50 hover:animate-pulse duration-300 transition-all"
    />
  );
};

export const PlayerId = ({
  selectedPlayer,
  selectedGuild,
  back,
}: {
  selectedPlayer: ContractAddress;
  selectedGuild?: number;
  back?: () => void;
}) => {
  const {
    setup: {
      components: {
        Owner,
        Structure,
        Position,
        events: { SettleRealmData },
      },
    },
  } = useDojo();

  const { getEntityName } = useEntitiesUtils();

  const { getAddressNameFromEntity } = useEntitiesUtils();

  const playerEntityId = useMemo(() => {
    if (!selectedPlayer) return;

    const playerEntityId = getComponentValue(
      Owner,
      Array.from(runQuery([HasValue(Owner, { address: selectedPlayer })]))[0],
    );
    return playerEntityId?.entity_id;
  }, [selectedPlayer]);

  const playerName = useMemo(() => {
    if (!selectedPlayer) return;

    if (!playerEntityId) return;

    const playerName = getAddressNameFromEntity(playerEntityId);
    return playerName;
  }, [selectedPlayer, playerEntityId]);

  const hasBeenPlayingFor = useMemo(() => {
    if (!selectedPlayer) return;

    const realmSettleData = getComponentValue(
      SettleRealmData,
      Array.from(runQuery([HasValue(SettleRealmData, { owner_address: selectedPlayer })]))[0],
    );
    return formatTime((useUIStore.getState()?.nextBlockTimestamp ?? 0) - (realmSettleData?.timestamp ?? 0));
  }, [selectedPlayer, playerEntityId]);

  const playerStructures = useMemo(() => {
    if (!selectedPlayer) return;

    const structuresEntityIds = runQuery([Has(Structure), HasValue(Owner, { address: selectedPlayer })]);
    const structures = Array.from(structuresEntityIds).map((entityId) => {
      const structure = getComponentValue(Structure, entityId);
      if (!structure) return undefined;

      const positionComponentValue = getComponentValue(Position, entityId);
      if (!positionComponentValue) return undefined;

      const position = new PositionType({ x: positionComponentValue.x, y: positionComponentValue.y });

      const structureName = getEntityName(structure.entity_id, true);
      return {
        structureName,
        ...structure,
        position,
      };
    });
    return structures;
  }, [playerEntityId]);

  return (
    <div className="pointer-events-auto">
      {selectedGuild && (
        <Button variant={"outline"} className={"mt-2 ml-2"} onClick={back}>
          <ArrowLeft className="w-2 mr-2" /> Back
        </Button>
      )}
      <div className="p-4 flex flex-row gap-2">
        <AvatarImage address={toHexString(selectedPlayer!)} />
        <div className="flex flex-row">
          <div className="flex flex-col mr-6">
            <div className="text-2xl font-bold flex flex-row items-center space-x-1 bg-brown/20 p-2 rounded-lg shadow-md">
              <span className="text-gold h6">{playerName || "No player selected"}</span>
              {playerName && (
                <div className="flex items-center justify-center p-1">
                  <MessageIcon playerName={playerName} selectedPlayer={selectedPlayer} />
                </div>
              )}
            </div>
            <div className="text-xs italic">
              {hasBeenPlayingFor ? `Joined ${hasBeenPlayingFor} ago` : "No player selected"}
            </div>
            <div className="text-xs">{playerEntityId ? "Player ID: " + playerEntityId : "No player selected"}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full p-1 max-h-[500px] overflow-y-auto">
        <div className="grid grid-cols-4 gap-1">
          {playerStructures?.map((structure) => {
            if (!structure) return null;

            let structureSpecificElement: JSX.Element | null;
            if (structure?.category === StructureType[StructureType.Realm]) {
              structureSpecificElement = (
                <div key={structure.entity_id}>
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
              <div key={structure.entity_id} className="flex flex-col gap-2 border-2 border-gold/10 p-2 rounded-md">
                <div className="flex flex-col justify-between text-xs font-bold truncate">
                  {structure.structureName}
                  <div className="flex flex-row items-center">
                    <NavigateToPositionIcon className="!w-5 !h-5" position={structure.position.getNormalized()} />
                    <ViewOnMapIcon className="!w-4 !h-4" position={structure.position.getNormalized()} />
                  </div>
                </div>
                {structureSpecificElement}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AvatarImage = ({ address }: { address: string }) => {
  const randomAvatarIndex = ((parseInt(address.slice(0, 8), 16) % 7) + 1).toString().padStart(2, "0");
  let imgSource = `./images/avatars/${randomAvatarIndex}.png`;

  return (
    <div className="w-36 min-w-36 mr-4">
      {<img className="h-36 w-36  object-cover  border-gold/10 border-2 bg-brown" src={imgSource} alt="" />}
    </div>
  );
};
