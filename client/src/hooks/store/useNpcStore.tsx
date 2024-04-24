import { create } from "zustand";
import { Npc } from "../../components/cityview/realm/villagers/types";

const callLoreMachineJsonRpcMethod = async (method: string, params: any) => {
  const response = await fetch(import.meta.env.VITE_OVERLORE_RPC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: method,
      params: [params],
      id: 1,
    }),
  });
  const responseJson = await response.json();
  if ("error" in responseJson) throw responseJson.error;
  else return JSON.parse(responseJson.result);
};

interface NpcState {
  loreMachineJsonRpcCall: (method: string, params: any) => Promise<any>;
  isDiscussionLoading: boolean;
  setIsDiscussionLoading: (val: boolean) => void;
  initializedRealms: bigint[];
  setInitialisedRealms: (val: bigint[]) => void;
}

const useNpcStore = create<NpcState>((set) => ({
  loreMachineJsonRpcCall: async (method: string, params: any): Promise<any> => {
    return await callLoreMachineJsonRpcMethod(method, params);
  },
  isDiscussionLoading: false,
  setIsDiscussionLoading: (val: boolean) => set({ isDiscussionLoading: val }),
  initializedRealms: [],
  setInitialisedRealms: (val: bigint[]) => set({ initializedRealms: val }),
}));

export default useNpcStore;
