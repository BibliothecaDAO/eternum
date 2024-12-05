import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import { useDojo } from "./context/DojoContext";

export const useRealmsSettled = () => {
  return useEntityQuery([Has(useDojo().setup.components.Realm)]).length;
};
