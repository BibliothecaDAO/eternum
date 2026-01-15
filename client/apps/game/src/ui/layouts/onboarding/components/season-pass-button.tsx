import { useEffect, useMemo, useState } from "react";

import { Castle, FileText, MessageSquare, Twitter as TwitterIcon } from "lucide-react";

import { useDojo, usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";

import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Button } from "@/ui/design-system/atoms";
import { SeasonPassRealm, getUnusedSeasonPasses } from "@/ui/features/settlement";

import { env } from "../../../../../env";
import { mintUrl } from "../constants";

export interface SeasonPassButtonProps {
  onSettleRealm: () => void;
}

export const SeasonPassButton = ({ onSettleRealm }: SeasonPassButtonProps) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();
  const { Structure } = components;

  const hasAcceptedTS = useUIStore((state) => state.hasAcceptedTS);
  const [seasonPassRealms, setSeasonPassRealms] = useState<SeasonPassRealm[]>([]);
  const realmsEntities = usePlayerOwnedRealmEntities();
  const villageEntities = usePlayerOwnedVillageEntities();

  useEffect(() => {
    let isMounted = true;

    const fetchSeasonPasses = async () => {
      try {
        const unsettledSeasonPassRealms = await getUnusedSeasonPasses(
          account.address,
          realmsEntities.map((entity) => getComponentValue(Structure, entity)?.metadata.realm_id || 0),
        );
        if (isMounted) {
          setSeasonPassRealms(unsettledSeasonPassRealms);
        }
      } catch (err) {
        console.error("Error fetching season passes:", err);
      }
    };

    fetchSeasonPasses();

    const intervalId = setInterval(fetchSeasonPasses, 10_000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [Structure, account.address, realmsEntities]);

  const hasRealmsOrVillages = useMemo(
    () => realmsEntities.length > 0 || villageEntities.length > 0,
    [realmsEntities, villageEntities],
  );

  const [settlingStartTimeRemaining, setSettlingStartTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now() / 1000;
      const timeLeft = env.VITE_PUBLIC_SETTLING_START_TIME - now;

      if (timeLeft <= 0) {
        setSettlingStartTimeRemaining("");
        return;
      }

      const days = Math.floor(timeLeft / (60 * 60 * 24));
      const hours = Math.floor((timeLeft % (60 * 60 * 24)) / (60 * 60));
      const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
      const seconds = Math.floor(timeLeft % 60);
      const time = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      setSettlingStartTimeRemaining(time);
    };

    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  const hasUnsettledSeasonPasses = seasonPassRealms.length > 0;
  const shouldGateByTerms = env.VITE_PUBLIC_ENABLE_TOS;

  if (shouldGateByTerms && !hasAcceptedTS) {
    return null;
  }

  return (
    <div className="space-y-4">
      {settlingStartTimeRemaining && (
        <div className="text-center text-xl">
          Settling will begin in <br /> <span className="text-gold font-bold">{settlingStartTimeRemaining}</span>
        </div>
      )}

      {hasUnsettledSeasonPasses && (
        <Button size="lg" forceUppercase={false} className="w-full rounded-md shadow-md" onClick={onSettleRealm}>
          <div className="flex items-center justify-start w-full">
            <Castle className="!w-5 !h-5 mr-2 fill-gold" />
            <span className="font-medium flex-grow text-center">Settle a Realm</span>
          </div>
        </Button>
      )}

      <div className="flex flex-col gap-3 w-full">
        <div className="flex w-full flex-wrap">
          <a
            className="text-brown cursor-pointer w-full"
            href={`${mintUrl}trade`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="lg"
              forceUppercase={false}
              className={`w-full rounded-md shadow-md ${!hasRealmsOrVillages ? "animate-pulse" : ""}`}
            >
              <div className="flex items-center justify-start w-full">
                <Castle className="!w-5 !h-5 mr-2 fill-gold" />
                <span className="font-medium flex-grow text-center">Season Passes</span>
              </div>
            </Button>
          </a>
          <a
            className="text-brown cursor-pointer w-full"
            href={`${mintUrl}mint`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="lg"
              forceUppercase={false}
              className={`w-full rounded-md shadow-md ${!hasRealmsOrVillages ? "animate-pulse" : ""}`}
            >
              <div className="flex items-center justify-start w-full">
                <TreasureChest className="!w-5 !h-5 mr-2 fill-gold" />
                <span className="font-medium flex-grow text-center">Claim Season Pass</span>
              </div>
            </Button>
          </a>
        </div>
      </div>

      <div className="flex w-full mt-3">
        <a
          className="text-brown cursor-pointer w-full"
          href="https://discord.gg/uQnjZhZPfu"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="lg" forceUppercase={false} className="w-full rounded-md shadow-md">
            <div className="flex items-center justify-start w-full">
              <MessageSquare className="!w-5 !h-5 mx-auto fill-gold" />
            </div>
          </Button>
        </a>
        <a
          className="text-brown cursor-pointer w-full"
          href="https://x.com/realms_gg"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="lg" forceUppercase={false} className="w-full rounded-md shadow-md">
            <div className="flex items-center justify-start w-full">
              <TwitterIcon className="!w-5 !h-5 mx-auto fill-gold" />
            </div>
          </Button>
        </a>
        <a
          className="text-brown cursor-pointer w-full"
          href="https://docs.realms.world/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="lg" forceUppercase={false} className="w-full rounded-md shadow-md">
            <div className="flex items-center w-full">
              <FileText className="!w-5 !h-5 mx-auto fill-gold" />
            </div>
          </Button>
        </a>
      </div>
    </div>
  );
};
