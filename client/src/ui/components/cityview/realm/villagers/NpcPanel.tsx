import { useEffect, useMemo, useState } from "react";
import useWebSocket from "react-use-websocket";
import Button from "../../../../elements/Button";
import NpcChat from "./NpcChat";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { ReactComponent as ArrowPrev } from "../../../../assets/icons/common/arrow-left.svg";
import { ReactComponent as ArrowNext } from "../../../../assets/icons/common/arrow-right.svg";
import { useDojo } from "../../../../DojoContext";
import { useNpcContext } from "./NpcContext";
import { StorageTownhalls } from "./types";
import { getRealm } from "../../../../utils/realms";

type NpcPanelProps = {
  type?: "all" | "farmers" | "miners";
};

export const NpcPanel = ({ type = "all" }: NpcPanelProps) => {
  const {
    sendJsonMessage,
    lastJsonMessage: LastWsMessage,
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

  const [spawned, setSpawned] = useState(0);
  const { realmId, realmEntityId } = useRealmStore();

  const LOCAL_STORAGE_ID = `npc_chat_${realmId}`;

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
  } = useNpcContext();

  const setSelectedTownhallFromDirection = (direction: number) => {
    const newKey = getNewTownhallKeyFromDirection(selectedTownhall, direction, LOCAL_STORAGE_ID);

    if (newKey == -1) {
      return;
    }

    setLastMessageDisplayedIndex(0);
    setSelectedTownhall(newKey);
  };

  const spawnNpc = async () => {
    // TODO make call to lore-machine backend to generate random name, ?characteristics? and character_trait (https://github.com/The-Overlore/eternum/issues/40)
    let npcId = await spawn_npc({
      signer: account,
      realm_id: realmEntityId,
      characteristics: 0,
      character_trait: "Helpful",
      name: "John",
    });
    setSpawned(spawned + 1);
  };

  useEffect(() => {
    const lastKey = getLastStorageTownhallKey(LOCAL_STORAGE_ID);
    if (lastKey == -1) {
      return;
    }
    setSelectedTownhall(lastKey);
  }, [realmId]);

  const gatherVillagers = () => {
    const npcsToSend = npcs.map((npc): any => {
      return { ...npc, entityId: npc.entityId.valueOf() };
    });
    sendJsonMessage({
      realm_id: realmId!.toString(),
      orderId: realm!.order,
      npcs: npcsToSend,
    });
    setLoadingTownhall(true);
  };

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
      <NpcChat LastWsMessage={LastWsMessage} />
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
