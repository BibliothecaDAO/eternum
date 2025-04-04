import { getBlockTimestamp } from "@/utils/timestamp";
import { ClientComponents, getEntityIdFromKeys, ID } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { ComponentValue } from "@dojoengine/recs";
import { syncEvents } from "@dojoengine/state";
import { Subscription } from "@dojoengine/torii-wasm";
import { useEffect, useState } from "react";

export const RaidResult = ({ raiderId, structureId }: { raiderId: ID; structureId: ID }) => {
  const {
    setup: {
      network: { toriiClient, contractComponents },
    },
  } = useDojo();

  const [raidTimestamp, setRaidTimestamp] = useState<number | null>(null);

  const [latestRaidResult, setLatestRaidResult] = useState<ComponentValue<
    ClientComponents["events"]["ExplorerRaidEvent"]["schema"]
  > | null>(null);

  useEffect(() => {
    setRaidTimestamp(getBlockTimestamp().currentBlockTimestamp);
  }, []);

  const raidResult = useComponentValue(
    contractComponents.events.ExplorerRaidEvent,
    getEntityIdFromKeys([BigInt(raiderId), BigInt(structureId)]),
  );

  useEffect(() => {
    if (raidResult && raidTimestamp) {
      if (raidResult.timestamp > raidTimestamp) {
        setLatestRaidResult(raidResult);
      }
    }
  }, [raidResult, raidTimestamp]);

  console.log({ latestRaidResult });

  useEffect(() => {
    let sub: Subscription | undefined;
    const syncRaidResult = async () => {
      sub = await syncEvents(
        toriiClient,
        contractComponents.events as any,
        [
          {
            Keys: {
              keys: [raiderId.toString(), structureId.toString()],
              pattern_matching: "FixedLen",
              models: ["s1_eternum-ExplorerRaidEvent"],
            },
          },
        ],
        // logging
        false,
        // historical
        false,
      );
    };
    if (raiderId && structureId) {
      syncRaidResult();
    }

    return () => {
      sub?.free();
    };
  }, [raiderId, structureId]);

  return <div>RaidSuccessResult</div>;
};
