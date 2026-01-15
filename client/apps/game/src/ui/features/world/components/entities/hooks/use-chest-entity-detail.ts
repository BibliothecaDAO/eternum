import { getCrateName } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";
import { useMemo } from "react";

interface UseChestEntityDetailOptions {
  chestEntityId: ID;
}

export const useChestEntityDetail = ({ chestEntityId }: UseChestEntityDetailOptions) => {
  const chestName = useMemo(() => getCrateName(chestEntityId), [chestEntityId]);

  return {
    chestName,
  };
};
