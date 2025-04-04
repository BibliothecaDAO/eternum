import { useDojo } from "@bibliothecadao/react";
import { useEffect, useState } from "react";
import { SettlementLocation } from "../settlement/settlement-types";
import { getQuestLocations } from "./quest-utils";

export const useQuestState = () => {
  const [questLocations, setQuestLocations] = useState<SettlementLocation[]>([]);

  const {
    account: { account },
    setup: { components },
  } = useDojo();

  useEffect(() => {
    getQuestLocations(components);
  }, [components]);

  console.log(questLocations);
};
