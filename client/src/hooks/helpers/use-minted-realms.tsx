import { useEffect, useState } from "react";
import { useDojo } from "../context/DojoContext";

export const useMintedRealms = () => {
  const {
    account: { account },
    network: { toriiClient },
  } = useDojo();

  const [mintedRealms, setMintedRealms] = useState(1000);

  useEffect(() => {
    const getEvents = async () => {
      const events = await toriiClient.getEventMessages(
        {
          limit: 1000,
          offset: 0,
          dont_include_hashed_keys: false,
          clause: {
            Member: {
              model: "eternum-SettleRealmData",
              member: "owner_address",
              operator: "Eq",
              value: { Primitive: { ContractAddress: account.address } },
            },
          },
        },
        true,
      );

      return events;
    };
    getEvents().then((events) => {
      const len = Object.keys(events).length;
      setMintedRealms(len);
    });
  }, [setMintedRealms]);

  return mintedRealms;
};
