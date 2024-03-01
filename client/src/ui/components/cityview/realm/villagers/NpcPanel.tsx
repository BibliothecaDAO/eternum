import { useEffect, useMemo, useState } from "react";
import useWebSocket from "react-use-websocket";
import Button from "../../../../elements/Button";
import NpcChat from "./NpcChat";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { ReactComponent as ArrowPrev } from "../../../../assets/icons/common/arrow-left.svg";
import { ReactComponent as ArrowNext } from "../../../../assets/icons/common/arrow-right.svg";
import { useDojo } from "../../../../DojoContext";
import { useNpcContext } from "./NpcContext";
import {
  NpcSpawnResponse,
  StorageTownhalls,
  WsMsgType,
  TownhallResponse,
  StorageTownhall,
  WsResponse,
  ErrorResponse,
} from "./types";
import { getRealm } from "../../../../utils/realms";
import { packCharacteristics } from "./utils";
import { BigNumberish, shortString } from "starknet";

type NpcPanelProps = {
  type?: "all" | "farmers" | "miners";
};

export const NpcPanel = ({ type = "all" }: NpcPanelProps) => {
  const {
    sendJsonMessage: sendWsMsg,
    lastJsonMessage: lastWsMsg,
    readyState: wsReadyState,
  } = useWebSocket(import.meta.env.VITE_OVERLORE_WS_URL, {
    share: false,
    shouldReconnect: () => true,
  });

  const {
    setup: {
      systemCalls: { spawn_npc },
    },
    account: { account },
  } = useDojo();

  const { realmId, realmEntityId } = useRealmStore();

  useEffect(() => {
    console.log(`Connection state changed ${wsReadyState}`);
  }, [wsReadyState]);

  const realm = useMemo(() => {
    return realmEntityId ? getRealm(realmId!) : undefined;
  }, [realmEntityId]);

  const {
    selectedTownhall,
    setSelectedTownhall,
    setLastMessageDisplayedIndex,
    loadingTownhall,
    setLoadingTownhall,
    npcs,
    LOCAL_STORAGE_ID,
    spawned,
    setSpawned,
  } = useNpcContext();

  const setSelectedTownhallFromDirection = (direction: number) => {
    const newKey = getNewTownhallKeyFromDirection(selectedTownhall, direction, LOCAL_STORAGE_ID);

    if (newKey == -1) {
      return;
    }

    setLastMessageDisplayedIndex(0);
    setSelectedTownhall(newKey);
  };

  const gatherVillagers = () => {
    const npcsToSend = npcs.map((npc): any => {
      return {
        characteristics: npc.characteristics,
        character_trait: npc.characterTrait,
        full_name: npc.fullName,
      };
    });
    sendWsMsg({
      msg_type: WsMsgType.TOWNHALL,
      data: {
        realm_id: realmId!.toString(),
        order_id: realm!.order,
        npcs: npcsToSend,
      },
    });
    setLoadingTownhall(true);
  };

  const spawnNpc = async () => {
    sendWsMsg({
      msg_type: WsMsgType.SPAWN_NPC,
      data: {
        realm_entity_id: Number(realmEntityId),
      },
    });
  };

  useEffect(() => {
    const lastKey = getLastStorageTownhallKey(LOCAL_STORAGE_ID);
    if (lastKey == -1) {
      return;
    }
    setSelectedTownhall(lastKey);
  }, [realmId]);

  const treatTownhallResponse = (response: TownhallResponse) => {
    setLastMessageDisplayedIndex(0);
    const townhallKey = addTownHallToStorage(response, LOCAL_STORAGE_ID);
    setSelectedTownhall(townhallKey);
    setLoadingTownhall(false);
  };

  const treatSpawnNpcResponse = async (response: NpcSpawnResponse) => {
    let npcId = await spawn_npc({
      signer: account,
      realm_entity_id: realmEntityId,
      characteristics: packCharacteristics(response.npc.characteristics),
      character_trait: shortString.encodeShortString(response.npc.character_trait),
      full_name: shortString.encodeShortString(response.npc.full_name),
      signature: response.signature as BigNumberish[],
    });
    setSpawned(spawned + 1);
  };

  useEffect(() => {
    if (lastWsMsg === null || lastWsMsg === undefined || Object.is(lastWsMsg, {})) {
      return;
    }
    const response = lastWsMsg as WsResponse;
    const msg_type = response.msg_type;
    if (msg_type === WsMsgType.SPAWN_NPC) {
      treatSpawnNpcResponse(response.data as NpcSpawnResponse);
    } else if (msg_type === WsMsgType.TOWNHALL) {
      treatTownhallResponse(response.data as TownhallResponse);
    } else if (msg_type === WsMsgType.ERROR) {
      console.log(`Failure in lore machine: ${(lastWsMsg as ErrorResponse).reason}`);
    }
  }, [lastWsMsg]);

  return (
    <div className="flex flex-col h-[250px] relative pb-3">
      <div className="flex flex-row w-[100%] items-center justify-between" style={{ position: "relative", top: "2%" }}>
        <Button className="mx-2 w-32 bottom-2 !rounded-full" onClick={spawnNpc} variant="primary">
          Spawn villager
        </Button>
        <Button
          className="mx-2 w-32 bottom-2 !rounded-full"
          onClick={gatherVillagers}
          variant={loadingTownhall ? "default" : "primary"}
        >
          Gather villagers
        </Button>

        <div className="flex relative">
          <Button onClick={() => setSelectedTownhallFromDirection(-1)}>
            <ArrowPrev />
          </Button>
          <div className="text-white">{selectedTownhall}</div>
          <Button onClick={() => setSelectedTownhallFromDirection(+1)} className="mr-2">
            <ArrowNext />
          </Button>
        </div>
      </div>
      <NpcChat />
    </div>
  );
};

const getNewTownhallKeyFromDirection = (
  selectedTownhall: number | null,
  direction: number,
  localStorageId: string,
): number => {
  if (selectedTownhall === null) {
    return -1;
  }

  const storedTownhalls: StorageTownhalls = JSON.parse(localStorage.getItem(localStorageId) ?? "{}");

  const keys = Object.keys(storedTownhalls).map((val) => Number(val));

  const currentKey = keys.indexOf(selectedTownhall);
  let newKey = keys[currentKey];

  if (currentKey + direction >= keys.length || currentKey + direction < 0) {
    return -1;
  }
  newKey = keys[currentKey + direction];
  return newKey;
};

const getLastStorageTownhallKey = (localStorageId: string): number => {
  const storageTownhalls: StorageTownhalls = JSON.parse(localStorage.getItem(localStorageId) ?? "{}");
  const keys = Object.keys(storageTownhalls).map((val) => Number(val));
  if (keys.length <= 0) {
    return -1;
  }
  const lastKey = keys[keys.length - 1];
  return lastKey;
};

const addTownHallToStorage = (message: TownhallResponse, localStorageId: string): number => {
  const townhallKey = message["townhall_id"];
  const townhallDiscussion: string[] = message["townhall"].split(/\n+/);

  if (townhallDiscussion[townhallDiscussion.length - 1] === "") {
    townhallDiscussion.pop();
  }

  const discussionsByNpc = townhallDiscussion.map((msg) => {
    const splitMessage = msg.split(":");
    return { npcName: splitMessage[0], dialogueSegment: splitMessage[1] === undefined ? "" : splitMessage[1] };
  });

  const newEntry: StorageTownhall = { viewed: false, discussion: discussionsByNpc };

  const townhallsInLocalStorage = localStorage.getItem(localStorageId);
  const storedTownhalls: StorageTownhalls = JSON.parse(townhallsInLocalStorage ?? "{}");
  storedTownhalls[townhallKey] = newEntry;
  localStorage.setItem(localStorageId, JSON.stringify(storedTownhalls));

  return townhallKey;
};
