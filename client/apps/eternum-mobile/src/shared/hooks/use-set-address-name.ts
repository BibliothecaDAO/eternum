import { useStore } from "@/shared/store";
import { SetupResult } from "@bibliothecadao/dojo";
import { ContractAddress } from "@bibliothecadao/types";
import { ControllerConnector } from "@cartridge/connector";
import { getComponentValue } from "@dojoengine/recs";
import { cairoShortStringToFelt } from "@dojoengine/torii-client";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useRef, useState } from "react";
import { AccountInterface, shortString } from "starknet";

export const useSetAddressName = (
  setup: SetupResult,
  controllerAccount: AccountInterface | null,
  connector: ControllerConnector | null,
) => {
  const setAddressName = useStore((state) => state.setAddressName);
  const [isAddressNameSet, setIsAddressNameSet] = useState(false);
  const hasSetUsername = useRef(false);

  useEffect(() => {
    const { components, systemCalls } = setup;

    const setUserNameFromConnector = async () => {
      if (hasSetUsername.current) return;

      let username: string | undefined;
      try {
        username = await connector?.username();
      } catch (error) {
        console.log("No username found in controller account", error);
      }

      if (!username || !controllerAccount) return;

      const usernameFelt = cairoShortStringToFelt(username.slice(0, 31));
      await systemCalls.set_address_name({ signer: controllerAccount, name: usernameFelt });
      setAddressName(username);
      setIsAddressNameSet(true);
      hasSetUsername.current = true;
    };

    const ensureAddressName = async () => {
      if (!controllerAccount || hasSetUsername.current) return;

      const address = ContractAddress(controllerAccount.address);
      const entityId = getEntityIdFromKeys([address]);
      const storedName = getComponentValue(components.AddressName, entityId)?.name;
      const decodedName = storedName ? shortString.decodeShortString(storedName.toString()) : undefined;

      if (!decodedName || decodedName === "0") {
        await setUserNameFromConnector();
      } else {
        setAddressName(decodedName);
        setIsAddressNameSet(true);
        hasSetUsername.current = true;
      }
    };

    void ensureAddressName();
  }, [connector, controllerAccount, setAddressName, setup]);

  return isAddressNameSet;
};
