import { Position } from "@/types/position";
import { getPlayerFirstRealm, getRandomRealmEntity } from "@/utils/realms";
import { ClientComponents, ContractAddress } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useAccount } from "@starknet-react/core";
import { useEffect } from "react";
import { NULL_ACCOUNT } from "../context/dojo-context";
import { useNavigateToHexView } from "./use-navigate";

export const useNavigateToRealmViewByAccount = (components: ClientComponents) => {
  const navigateToHexView = useNavigateToHexView();
  const { account } = useAccount();

  // navigate to random hex view if not connected or to player's first realm if connected
  useEffect(() => {
    if (!account) {
      const randomRealmEntity = getRandomRealmEntity(components);
      const position = randomRealmEntity ? getComponentValue(components.Position, randomRealmEntity) : undefined;
      navigateToHexView(new Position(position || { x: 0, y: 0 }));
    } else {
      const playerRealm = getPlayerFirstRealm(components, ContractAddress(account?.address || NULL_ACCOUNT.address));
      const position = playerRealm ? getComponentValue(components.Position, playerRealm) : undefined;
      position && navigateToHexView(new Position(position));
    }
  }, [account?.address]);
};
