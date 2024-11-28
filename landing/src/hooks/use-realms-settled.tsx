import { defineQuery, getComponentValue, Has, isComponentUpdate } from "@dojoengine/recs";
import { useEffect, useState } from "react";
import { useDojo } from "./context/DojoContext";

export const useRealmsSettled = () => {
  const {
    setup: {
      components: {
        events: { SettleRealmData },
      },
    },
  } = useDojo();

  const [realmsSettled, setRealmsSettled] = useState(0);

  useEffect(() => {
    const query = defineQuery([Has(SettleRealmData)], {
      runOnInit: true,
    });

    const subscription = query.update$.subscribe((update) => {
      if (isComponentUpdate(update, SettleRealmData)) {
        const event = getComponentValue(SettleRealmData, update.entity);
        if (!event) return;
        setRealmsSettled((prev) => prev + 1);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return realmsSettled;
};
