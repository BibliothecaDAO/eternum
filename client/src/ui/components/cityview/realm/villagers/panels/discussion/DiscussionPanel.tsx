import { useEffect, useMemo, useState } from "react";
import Button from "../../../../../../elements/Button";
import NpcChat from "./NpcChat";
import { ReactComponent as ArrowPrev } from "../../../../../../../assets/icons/common/arrow-left.svg";
import { ReactComponent as ArrowNext } from "../../../../../../../assets/icons/common/arrow-right.svg";
import { StorageDiscussions, DiscussionRpcResponse, StorageDiscussion } from "../../types";
import { getRealm } from "../../../../../../utils/realms";
import { keysSnakeToCamel } from "../../utils";
import TextInput from "../../../../../../elements/TextInput";
import { MAX_DISCUSSION_INPUT_LENGTH } from "../../constants";
import { ReactComponent as Bell } from "../../../../../../../assets/icons/npc/bell.svg";
import { useDiscussion } from "./DiscussionContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import useNpcStore from "@/hooks/store/useNpcStore";

type DiscussionPanelProps = {
  type?: "all" | "farmers" | "miners";
};

export const DiscussionPanel = ({ type = "all" }: DiscussionPanelProps) => {
  const { realmId, realmEntityId } = useRealmStore();
  const [DiscussionInput, setDiscussionInput] = useState("");

  const { selectedDiscussion, setSelectedDiscussion, setLastMessageDisplayedIndex } = useDiscussion();

  const LOCAL_STORAGE_ID: string = `npc_chat_${realmId}`;

  const realm = useMemo(() => {
    return realmEntityId ? getRealm(realmId!) : undefined;
  }, [realmEntityId]);

  const { loreMachineJsonRpcCall, setIsDiscussionLoading } = useNpcStore();

  const setSelectedDiscussionFromDirection = (direction: number) => {
    const newTimeStamp = getNewDiscussionTimeStampFromDirection(selectedDiscussion, direction, LOCAL_STORAGE_ID);

    if (newTimeStamp == -1) {
      return;
    }

    setLastMessageDisplayedIndex(0);
    setSelectedDiscussion(newTimeStamp);
  };

  const treatGenerateDiscussionResponse = (response: DiscussionRpcResponse) => {
    setLastMessageDisplayedIndex(0);
    const discussionTimeStamp = addDiscussionToStorage(response, LOCAL_STORAGE_ID);
    setSelectedDiscussion(discussionTimeStamp);
    setIsDiscussionLoading(false);
  };

  const gatherVillagers = async () => {
    setIsDiscussionLoading(true);
    try {
      let response = await loreMachineJsonRpcCall("generateDiscussion", {
        realm_id: Number(realmId!),
        realm_entity_id: Number(realmEntityId!),
        order_id: realm!.order,
        user_input: DiscussionInput,
      });
      response = keysSnakeToCamel(response);
      treatGenerateDiscussionResponse(response.discussion as DiscussionRpcResponse);
    } catch (e) {
      console.log(e);
    }
    setIsDiscussionLoading(false);
  };

  useEffect(() => {
    const mostRecentTs = getMostRecentStorageDiscussionKey(LOCAL_STORAGE_ID);
    if (mostRecentTs == -1) {
      setSelectedDiscussion(null);
      return;
    }
    setSelectedDiscussion(mostRecentTs);
  }, [realmId]);

  const handleUserMessageChange = (inputValue: string) => {
    if (inputValue.length <= MAX_DISCUSSION_INPUT_LENGTH) {
      setDiscussionInput(inputValue);
    }
  };

  const getDate = (): string => {
    const date = new Date(0);
    date.setUTCSeconds(selectedDiscussion!);
    return `${date.toLocaleDateString()} - ${date.toLocaleTimeString()}`;
  };

  return (
    <div className="flex flex-col h-[250px] relative">
      <div className="flex flex-row w-[100%] items-center justify-between" style={{ position: "relative", top: "2%" }}>
        {selectedDiscussion !== 0 && (
          <div className="flex relative">
            <Button onClick={() => setSelectedDiscussionFromDirection(-1)}>
              <ArrowPrev />
            </Button>
            <div className="text-white">{getDate()}</div>
            <Button onClick={() => setSelectedDiscussionFromDirection(+1)} className="mr-2">
              <ArrowNext />
            </Button>
          </div>
        )}
      </div>
      <NpcChat />

      <div className="flex my-1 items-center">
        <TextInput
          className="mx-2 border border-gold !text-white/70"
          placeholder="Write something..."
          value={DiscussionInput}
          onChange={handleUserMessageChange}
        />
        <Button className="mr-2" onClick={gatherVillagers}>
          <Bell className="h-5 fill-gold" />
        </Button>
      </div>
    </div>
  );
};

const getNewDiscussionTimeStampFromDirection = (
  selectedDiscussion: number | null,
  direction: number,
  localStorageId: string,
): number => {
  if (selectedDiscussion === null) {
    return -1;
  }

  const storedDiscussions: StorageDiscussions = JSON.parse(localStorage.getItem(localStorageId) ?? "{}");

  const keys = Object.keys(storedDiscussions).map((val) => Number(val));

  const currentKey = keys.indexOf(selectedDiscussion);
  let newKey = keys[currentKey];

  if (currentKey + direction >= keys.length || currentKey + direction < 0) {
    return -1;
  }
  newKey = keys[currentKey + direction];
  return newKey;
};

export const getMostRecentStorageDiscussionKey = (localStorageId: string): number => {
  const storageDiscussions: StorageDiscussions = JSON.parse(localStorage.getItem(localStorageId) ?? "{}");
  if (Object.keys(storageDiscussions).length === 0) {
    return 0;
  }

  const mostRecentTs = Math.max(...Object.keys(storageDiscussions).map(Number));
  return mostRecentTs;
};

export const addDiscussionToStorage = (message: DiscussionRpcResponse, localStorageId: string): number => {
  const ts = message.timestamp;

  const newEntry: StorageDiscussion = {
    viewed: false,
    dialogue: message.dialogue,
  };

  const discussionsInLocalStorage = localStorage.getItem(localStorageId);
  const storedDiscussions: StorageDiscussions = JSON.parse(discussionsInLocalStorage ?? "{}");
  storedDiscussions[ts] = newEntry;
  localStorage.setItem(localStorageId, JSON.stringify(storedDiscussions));

  return ts;
};
