import { defineQuery, getComponentValue, Has, isComponentUpdate } from "@dojoengine/recs";
import { useEffect, useState } from "react";
import { useDojo } from "./context/dojo-context";

export const useDonkeysBurned = () => {
  const {
    setup: {
      components: {
        events: { BurnDonkey },
      },
    },
  } = useDojo();

  const [donkeysBurned, setDonkeysBurned] = useState(0);

  useEffect(() => {
    const query = defineQuery([Has(BurnDonkey)], {
      runOnInit: true,
    });

    const subscription = query.update$.subscribe((update) => {
      if (isComponentUpdate(update, BurnDonkey)) {
        const event = getComponentValue(BurnDonkey, update.entity);
        if (!event) return;
        setDonkeysBurned((prev) => prev + Number(event.amount));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return donkeysBurned;
};
