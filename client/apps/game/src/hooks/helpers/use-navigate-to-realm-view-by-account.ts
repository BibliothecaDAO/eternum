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
      const strucutureBase = randomRealmEntity
        ? getComponentValue(components.Structure, randomRealmEntity)?.base
        : undefined;
      strucutureBase && navigateToHexView(new Position({ x: strucutureBase.coord_x, y: strucutureBase.coord_y }));
    } else {
      const playerRealm = getPlayerFirstRealm(components, ContractAddress(account?.address || NULL_ACCOUNT.address));
      const structureBase = playerRealm ? getComponentValue(components.Structure, playerRealm)?.base : undefined;
      structureBase && navigateToHexView(new Position({ x: structureBase.coord_x, y: structureBase.coord_y }));
    }
  }, [account?.address]);
};
