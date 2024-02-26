import { useEffect, useState } from "react";
import Button from "../../../../elements/Button";
import NpcChat from "./NpcChat";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { ReactComponent as ArrowPrev } from "../../../../assets/icons/common/arrow-left.svg";
import { ReactComponent as ArrowNext } from "../../../../assets/icons/common/arrow-right.svg";
import { useDojo } from "../../../../DojoContext";
import { useNpcContext } from "./NpcContext";
import { StorageTownhalls } from "./types";

type NpcPanelProps = {
  type?: "all" | "farmers" | "miners";
};

export const NpcPanel = ({ type = "all" }: NpcPanelProps) => {
  const {
    setup: {
      systemCalls: { spawn_npc },
    },
    account: { account },
  } = useDojo();

  const { realmId, realmEntityId } = useRealmStore();

  const LOCAL_STORAGE_ID = `npc_chat_${realmId}`;

  const { selectedTownhall, setSelectedTownhall, setLastMessageDisplayedIndex, loadingTownhall, setLoadingTownhall } =
    useNpcContext();

  const [townHallRequest, setTownHallRequest] = useState(-1);

  const setSelectedTownhallFromDirection = (direction: number) => {
    const newKey = getNewTownhallKeyFromDirection(selectedTownhall, direction, LOCAL_STORAGE_ID);

    if (newKey == -1) {
      return;
    }

    setLastMessageDisplayedIndex(0);
    setSelectedTownhall(newKey);
  };

  const spawnNpc = async () => {
    let _npcId = await spawn_npc({ signer: account, realm_id: realmEntityId });
  };

  useEffect(() => {
    const lastKey = getLastStorageTownhallKey(LOCAL_STORAGE_ID);
    if (lastKey == -1) {
      return;
    }
    setSelectedTownhall(lastKey);
  }, [realmId]);

  const gatherVillagers = () => {
    setTownHallRequest(townHallRequest + 1);
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
      <NpcChat townHallRequest={townHallRequest} />
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
