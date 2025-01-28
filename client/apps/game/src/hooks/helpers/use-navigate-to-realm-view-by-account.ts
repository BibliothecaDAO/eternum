import { getPlayerFirstRealm, getRandomRealmEntity } from "@/utils/realms";
import { ClientComponents, ContractAddress } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useAccount } from "@starknet-react/core";
import { useEffect } from "react";
import { useNavigateToHexView } from "./use-navigate";

export const useNavigateToRealmViewByAccount = (components: ClientComponents) => {
  const navigateToHexView = useNavigateToHexView();
  const { account } = useAccount();

  // navigate to random hex view if not connected or to player's first realm if connected
  useEffect(() => {
    if (!account) {
      const randomRealmEntity = getRandomRealmEntity(components);
      const position = randomRealmEntity ? getComponentValue(components.Position, randomRealmEntity) : undefined;
      position && navigateToHexView(position);
    } else {
      const playerRealm = getPlayerFirstRealm(components, ContractAddress(account?.address || "0x0"));
      const position = playerRealm ? getComponentValue(components.Position, playerRealm) : undefined;
      position && navigateToHexView(position);
    }
  }, [account?.address]);
};
