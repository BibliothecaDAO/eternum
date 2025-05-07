import { useAddressStore } from "@/hooks/store/use-address-store";
import { SetupResult } from "@bibliothecadao/dojo";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import ControllerConnector from "@cartridge/connector/controller";
import { getComponentValue } from "@dojoengine/recs";
import { cairoShortStringToFelt } from "@dojoengine/torii-client";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useState } from "react";
import { AccountInterface, shortString } from "starknet";

export const useSetAddressName = (value: SetupResult, controllerAccount: AccountInterface | null, connector: any) => {
  const {
    setup: { components },
  } = useDojo();

  const setAddressName = useAddressStore((state) => state.setAddressName);
  const [isAddressNameSet, setIsAddressNameSet] = useState(false);

  useEffect(() => {
    const setUserName = async () => {
      let username;
      try {
        username = await (connector as unknown as ControllerConnector)?.username();
        if (!username) {
          username = "adventurer"; // Default to adventurer in local mode
        }
      } catch (error) {
        username = "adventurer"; // If username() fails, we're in local mode
        console.log("Using default username 'adventurer' for local mode");
      }

      const usernameFelt = cairoShortStringToFelt(username.slice(0, 31));
      const calldata = {
        signer: controllerAccount!,
        name: usernameFelt,
      };
      value.systemCalls.set_address_name(calldata);
      setAddressName(username);
      setIsAddressNameSet(true);
    };

    const handleAddressName = async () => {
      if (controllerAccount) {
        const address = ContractAddress(controllerAccount.address);
        // can use because we have synced all address names
        const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([address]))?.name;

        if (!addressName) {
          await setUserName();
        } else {
          const decodedAddressName = shortString.decodeShortString(addressName?.toString());
          setAddressName(decodedAddressName);
          setIsAddressNameSet(true);
        }
      }
    };

    handleAddressName();
  }, [controllerAccount, connector, value, setAddressName]);

  return isAddressNameSet;
};
