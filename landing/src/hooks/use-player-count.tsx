import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import { useDojo } from "./context/DojoContext";

export const usePlayerCount = () => {
  return useEntityQuery([Has(useDojo().setup.components.AddressName)]).length;
};
