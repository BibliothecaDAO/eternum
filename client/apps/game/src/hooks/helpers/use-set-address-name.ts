import { useAddressStore } from "@/hooks/store/use-address-store";
import { SetupResult } from "@bibliothecadao/dojo";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import ControllerConnector from "@cartridge/connector/controller";
import { getComponentValue } from "@dojoengine/recs";
import { cairoShortStringToFelt } from "@dojoengine/torii-client";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useRef, useState } from "react";
import { AccountInterface, shortString } from "starknet";

export const useSetAddressName = (value: SetupResult, controllerAccount: AccountInterface | null, connector: any) => {
  const {
    setup: { components },
  } = useDojo();

  const setAddressName = useAddressStore((state) => state.setAddressName);
  const [isAddressNameSet, setIsAddressNameSet] = useState(false);
  const hasSetUsername = useRef(false);

  useEffect(() => {
    // set usser name for the controller account
    const setUserName = async () => {
      if (hasSetUsername.current) return;

      let username;
      try {
        username = await (connector as unknown as ControllerConnector)?.username();
        console.log({ username });
      } catch (error) {
        console.log("No username found in controller account");
      }

      if (username) {
        const usernameFelt = cairoShortStringToFelt(username.slice(0, 31));
        const calldata = {
          signer: controllerAccount!,
          name: usernameFelt,
        };
        value.systemCalls.set_address_name(calldata);
        setAddressName(username);
        setIsAddressNameSet(true);
        hasSetUsername.current = true;
      }
    };

    const handleAddressName = async () => {
      if (controllerAccount && !hasSetUsername.current) {
        const address = ContractAddress(controllerAccount.address);
        // can use because we have synced all address names
        const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([address]))?.name;
        const decodedAddressName = addressName ? shortString.decodeShortString(addressName.toString()) : undefined;

        if (!decodedAddressName || decodedAddressName === "0") {
          await setUserName();
        } else {
          setAddressName(decodedAddressName);
          setIsAddressNameSet(true);
          hasSetUsername.current = true;
        }
      }
    };

    handleAddressName();
  }, [controllerAccount, connector, value, setAddressName]);

  return isAddressNameSet;
};
