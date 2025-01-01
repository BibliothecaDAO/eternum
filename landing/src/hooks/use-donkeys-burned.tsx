import { defineQuery, getComponentValue, HasValue, isComponentUpdate } from "@dojoengine/recs";
import { useEffect, useState } from "react";
import { useDojo } from "./context/DojoContext";

const BREEDER_TASK_ID = "0x42524545444552" // 'BREEDER' to felt252

export const useDonkeysBurned = () => {
  const {
    setup: {
      components: {
        events: { TrophyProgression },
      },
    },
  } = useDojo();

  const [donkeysBurned, setDonkeysBurned] = useState(0);

  useEffect(() => {
    const query = defineQuery([
      HasValue(TrophyProgression, { task_id: BigInt(BREEDER_TASK_ID) }),
    ], {
      runOnInit: true,
    });

    const subscription = query.update$.subscribe((update) => {
      if (isComponentUpdate(update, TrophyProgression)) {
        const event = getComponentValue(TrophyProgression, update.entity);
        if (!event) return;
        setDonkeysBurned((prev) => prev + Number(event.count));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return donkeysBurned;
};
