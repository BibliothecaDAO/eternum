import { useEffect } from "react";
import { useDojo } from "../context/DojoContext";

export const ACCOUNT_CHANGE_EVENT = "addressChanged";

export const useAccountChange = () => {
  const setupResult = useDojo();
  useEffect(() => {
    console.log("changed address: ", setupResult.network.burnerManager.account?.address);
    window.dispatchEvent(new Event(ACCOUNT_CHANGE_EVENT));
  }, [setupResult.network.burnerManager.account?.address]);
};
