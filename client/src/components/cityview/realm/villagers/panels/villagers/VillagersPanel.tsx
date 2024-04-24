import { useMemo, useState } from "react";
import { useDojo } from "../../../../../../DojoContext";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { BigNumberish, shortString } from "starknet";
import { SortPanel } from "../../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../../elements/SortButton";
import { Headline } from "../../../../../../elements/Headline";
import { Traveler } from "./npcTypes/travelers/Traveler";
import { Resident } from "./npcTypes/residents/Resident";
import { AtGatesNpc } from "./npcTypes/atGates/AtGatesNpc";
import {
  NPC_CONFIG_ID,
  keysSnakeToCamel,
  packCharacteristics,
  getAtGatesNpcs,
  useResidentsNpcs,
  getTravelersNpcs,
} from "../../utils";
import useBlockchainStore from "../../../../../../hooks/store/useBlockchainStore";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
import useNpcStore from "../../../../../../hooks/store/useNpcStore";
import { ReactComponent as Plus } from "../../../../../../assets/icons/npc/plus.svg";
import { NpcSortButton } from "../../NpcSortButton";
import { NpcPopup } from "../../NpcPopup";
import { Npc } from "../../types";

export const VillagersPanel = () => {
  const [selectedNpc, setSelectedNpc] = useState<Npc | undefined>(undefined);

  const {
    setup: {
      components: { LastSpawned, NpcConfig, RealmRegistry, Npc: NpcComponent, EntityOwner, ArrivalTime, Position },
      systemCalls: { spawn_npc },
    },
    account: { account },
  } = useDojo();

  const { realmId, realmEntityId } = useRealmStore();
  const { nextBlockTimestamp } = useBlockchainStore();
  const { loreMachineJsonRpcCall } = useNpcStore();

  const travelers = getTravelersNpcs(realmId!, realmEntityId, NpcComponent, EntityOwner, Position);
  const residents = useResidentsNpcs(realmEntityId, NpcComponent, EntityOwner);
  const atGates = getAtGatesNpcs(
    realmId!,
    realmEntityId!,
    nextBlockTimestamp!,
    NpcComponent,
    Position,
    ArrivalTime,
    EntityOwner,
  );

  const npcGroupSortingParams = useMemo(() => {
    return [
      { label: "Residents", className: "mr-4" },
      { label: "Travelers", className: "mr-4" },
      { label: "Gates", className: "" },
    ];
  }, []);

  const [activeNpcGroup, setActiveNpcGroup] = useState("None");

  const sortingParams = useMemo(() => {
    return [
      { label: "Name", sortKey: "fullName", className: "mr-4" },
      { label: "Role", sortKey: "balance", className: "mr-4" },
      { label: "Age", sortKey: "number", className: "mr-4" },
      { label: "Gender", sortKey: "Characteristics-sex", className: "mr-4" },
      { label: "Character Trait", sortKey: "trait", className: "" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const getHeadline = (npc_count: number, title: string) => {
    return (
      <Headline className="px-10 my-2">
        <div className="flex flex-row text-light-pink">
          <p>{npc_count}</p>
          <div className="flex">
            <p className="ml-1">{title}</p>
            {title == "Residents" && <Plus onClick={spawnNpc} className="ml-1 rounded-sm bg-gold" />}
          </div>
        </div>
      </Headline>
    );
  };

  const spawnNpc = async () => {
    const npcConfig = getComponentValue(
      NpcConfig,
      getEntityIdFromKeys([BigInt("0x" + NPC_CONFIG_ID.toString(16))]) as Entity,
    );
    const last_spawned = getComponentValue(LastSpawned, getEntityIdFromKeys([BigInt(realmEntityId)]));

    const spawnDelay: bigint = npcConfig!.spawn_delay;
    const lastSpawnedTimestamp: bigint = BigInt(last_spawned?.last_spawned_ts ?? 0);
    const nextBlockTimestampBigint: bigint = BigInt(nextBlockTimestamp!);

    if (nextBlockTimestampBigint < spawnDelay + lastSpawnedTimestamp) {
      console.log("Can't spawn: spawn delay has not passed yet");
      return;
    }

    const realmRegistry = getComponentValue(RealmRegistry, getEntityIdFromKeys([BigInt(realmEntityId)]));
    if ((realmRegistry?.num_native_npcs ?? 0) >= 5 || (realmRegistry?.num_resident_npcs ?? 0) >= 5) {
      console.log("Can't spawn: too many NPCs");
      return;
    }
    try {
      let response = await loreMachineJsonRpcCall("spawnNpc", {
        realm_entity_id: Number(realmEntityId),
      });
      response = keysSnakeToCamel(response);
      await spawn_npc({
        signer: account,
        realm_entity_id: realmEntityId,
        characteristics: packCharacteristics(response.npc.characteristics),
        character_trait: shortString.encodeShortString(response.npc.characterTrait),
        full_name: shortString.encodeShortString(response.npc.fullName),
        signature: response.signature as BigNumberish[],
      });
    } catch (e) {
      console.log(e);
    }
  };

  const onClose = (): void => {
    setSelectedNpc(undefined);
  };

  return (
    <div className="flex flex-col">
      {selectedNpc && <NpcPopup selectedNpc={selectedNpc} onClose={onClose} />}

      <SortPanel className="flex justify-between px-3 py-2">
        {sortingParams.map(({ label, sortKey, className }) => (
          <SortButton
            className={className}
            key={sortKey}
            label={label}
            sortKey={sortKey}
            activeSort={activeSort}
            onChange={(_sortKey, _sort) => {
              setActiveSort({
                sortKey: _sortKey,
                sort: _sort,
              });
            }}
          />
        ))}
      </SortPanel>

      <SortPanel className="flex justify-center px-3 py-2 ">
        {npcGroupSortingParams.map(({ label, className }) => (
          <>
            <NpcSortButton
              key={label}
              className={className}
              label={label}
              isActive={activeNpcGroup === label}
              onChange={() => {
                setActiveNpcGroup((prevState) => (prevState === label ? "None" : label));
              }}
            />
          </>
        ))}
      </SortPanel>

      {/* RESIDENTS */}
      {(activeNpcGroup === "Residents" || activeNpcGroup === "None") && (
        <>
          <div className="flex items-center">
            {getHeadline(residents.natives.length + residents.foreigners.length, "Residents")}
          </div>

          {residents.natives.map((npc) => (
            <div className="flex flex-col p-2" key={npc.entityId}>
              <Resident npc={npc} setSelectedNpc={setSelectedNpc} native={true} />
            </div>
          ))}

          {residents.foreigners &&
            residents.foreigners.map((npc) => (
              <div className="flex flex-col p-2" key={npc.entityId}>
                <Resident npc={npc} setSelectedNpc={setSelectedNpc} native={false} />
              </div>
            ))}
        </>
      )}

      {/* TRAVELERS */}
      {(activeNpcGroup === "Travelers" || activeNpcGroup === "None") && (
        <>
          {getHeadline(travelers.length, "Travelers")}
          {travelers.map((npc) => (
            <div className="flex flex-col p-2" key={npc.entityId}>
              <Traveler npc={npc} setSelectedNpc={setSelectedNpc} />
            </div>
          ))}
        </>
      )}

      {/* GATES */}
      {(activeNpcGroup === "Gates" || activeNpcGroup === "None") && (
        <>
          {getHeadline(atGates.length, "At Your Gates")}
          {atGates.map((atGates) => (
            <div className="flex flex-col p-2" key={atGates.npc.entityId}>
              <AtGatesNpc npc={atGates.npc} setSelectedNpc={setSelectedNpc} />
            </div>
          ))}
        </>
      )}
    </div>
  );
};
