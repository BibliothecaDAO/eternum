import { useEffect, useMemo, useState } from "react";
import { Resident } from "./Resident";
import { SortPanel } from "../../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../../elements/SortButton";
import { useNpcContext } from "../../NpcContext";
import Button from "../../../../../../elements/Button";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
import { NpcSpawnResponse, WsMsgType, WsResponse } from "../../types";
import { NPC_CONFIG_ID, getResidentNpcs, keysSnakeToCamel, packCharacteristics } from "../../utils";
import { useDojo } from "../../../../../../DojoContext";
import { BigNumberish, shortString } from "starknet";
import useBlockchainStore from "../../../../../../hooks/store/useBlockchainStore";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Entity, getComponentValue } from "@dojoengine/recs";

export const ResidentsPanel = () => {
  const {
    setup: {
      components: { LastSpawned, NpcConfig, RealmRegistry, Npc: NpcComponent, EntityOwner },
      systemCalls: { spawn_npc },
    },
    account: { account },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { realmEntityId } = useRealmStore();

  const { sendWsMsg, lastWsMsg } = useNpcContext();

  const residents = getResidentNpcs(realmEntityId, NpcComponent, EntityOwner);

  const sortingParams = useMemo(() => {
    return [
      { label: "Age", sortKey: "number", className: "mr-4" },
      { label: "Role", sortKey: "balance", className: "" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  useEffect(() => {
    if (lastWsMsg === null || lastWsMsg === undefined || Object.is(lastWsMsg, {})) {
      return;
    }
    const response = keysSnakeToCamel(lastWsMsg) as WsResponse;
    const msg_type = response.msgType;
    if (msg_type === WsMsgType.SPAWN_NPC) {
      treatSpawnNpcResponse(response.data as NpcSpawnResponse);
    }
  }, [lastWsMsg]);

  const treatSpawnNpcResponse = async (response: NpcSpawnResponse) => {
    await spawn_npc({
      signer: account,
      realm_entity_id: realmEntityId,
      characteristics: packCharacteristics(response.npc.characteristics),
      character_trait: shortString.encodeShortString(response.npc.characterTrait),
      full_name: shortString.encodeShortString(response.npc.fullName),
      signature: response.signature as BigNumberish[],
    });
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
    sendWsMsg({
      msg_type: WsMsgType.SPAWN_NPC,
      data: {
        realm_entity_id: Number(realmEntityId),
      },
    });
  };

  return (
    <div className="flex flex-col">
      <SortPanel className="flex justify-center px-3 py-2">
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

      {residents.natives.map((npc) => (
        <div className="flex flex-col p-2" key={npc.entityId}>
          <Resident npc={npc} native={true} />
        </div>
      ))}
      {residents.foreigners.map((npc) => (
        <div className="flex flex-col p-2" key={npc.entityId}>
          <Resident npc={npc} native={false} />
        </div>
      ))}
      <div className="flex justify-center">
        <Button className="mx-2 m-2 w-32 bottom-2 !rounded-full" onClick={spawnNpc} variant="primary">
          Spawn villager
        </Button>
      </div>
    </div>
  );
};
