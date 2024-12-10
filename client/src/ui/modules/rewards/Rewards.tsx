import { useDojo } from "@/hooks/context/DojoContext";
import { usePrizePool } from "@/hooks/helpers/use-rewards";
import { useGetHyperstructuresWithContributionsFromPlayer } from "@/hooks/helpers/useContributions";
import { useGetPlayerEpochs } from "@/hooks/helpers/useHyperstructures";
import useUIStore from "@/hooks/store/useUIStore";
import { HintSection } from "@/ui/components/hints/HintModal";
import { rewards } from "@/ui/components/navigation/Config";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import Button from "@/ui/elements/Button";
import { formatTime, getEntityIdFromKeys } from "@/ui/utils/utils";
import { ContractAddress, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { shortString } from "starknet";
import { formatEther } from "viem";
import { env } from "../../../../env";

const REGISTRATION_DELAY = 1800; // 1 week

export const Rewards = () => {
  const {
    account: { account },
    network: { provider },
    setup: {
      components: {
        AddressName,
        Leaderboard,
        LeaderboardRegistered,
        events: { GameEnded },
      },
      systemCalls: { register_to_leaderboard, claim_leaderboard_rewards },
    },
  } = useDojo();

  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const prizePool = usePrizePool();
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(rewards));

  const getContributions = useGetHyperstructuresWithContributionsFromPlayer();
  const getEpochs = useGetPlayerEpochs();

  const gameEndedEntityId = useEntityQuery([Has(GameEnded)]);

  const gameEnded = useMemo(() => {
    return getComponentValue(GameEnded, gameEndedEntityId[0]);
  }, [gameEndedEntityId]);

  const leaderboard = useComponentValue(Leaderboard, getEntityIdFromKeys([WORLD_CONFIG_ID]));

  const registerToLeaderboard = useCallback(async () => {
    setIsLoading(true);
    const contributions = Array.from(getContributions());
    const epochs = getEpochs();

    await register_to_leaderboard({
      signer: account,
      hyperstructure_contributed_to: contributions,
      hyperstructure_shareholder_epochs: epochs,
    });
    setIsLoading(false);
  }, [getContributions, getEpochs]);

  const claimRewards = useCallback(async () => {
    setIsLoading(true);
    await claim_leaderboard_rewards({
      signer: account,
      token: env.VITE_LORDS_ADDRESS!,
    });
    setIsLoading(false);
  }, [account]);

  useEffect(() => {
    if (gameEnded) {
      const calculateTimeRemaining = () => {
        const currentTime = Math.floor(Date.now() / 1000);
        const endTime = Number(gameEnded.timestamp + REGISTRATION_DELAY);

        if (currentTime >= endTime) {
          setTimeRemaining("Registration Closed");
          return;
        }

        const difference = endTime - currentTime;
        setTimeRemaining(formatTime(difference, undefined));
      };

      calculateTimeRemaining();
      const timer = setInterval(calculateTimeRemaining, 1000);

      return () => clearInterval(timer);
    }
  }, [gameEnded]);

  const registeredPlayers = useMemo(() => {
    const registeredPlayers = runQuery([Has(LeaderboardRegistered)]);
    return registeredPlayers.size;
  }, [gameEnded]);

  const seasonWinner = useMemo(() => {
    if (!gameEnded) return "";
    const seasonWinner = getComponentValue(AddressName, getEntityIdFromKeys([gameEnded?.winner_address]));
    return shortString.decodeShortString(seasonWinner?.name.toString() ?? "");
  }, [gameEnded]);

  const registrationStatus = useMemo(() => {
    const registered = getComponentValue(
      LeaderboardRegistered,
      getEntityIdFromKeys([ContractAddress(account.address)]),
    );
    return registered ? "registered" : "unregistered";
  }, [timeRemaining]);

  const registrationClosed = timeRemaining === "Registration Closed";

  return (
    <OSWindow
      width="600px"
      onClick={() => togglePopup(rewards)}
      show={isOpen}
      title={rewards}
      hintSection={HintSection.Tribes}
    >
      <div className="p-4">
        <div className="flex flex-col gap-4">
          {/* Prize pool and registration time */}
          <div className="grid grid-cols-2 gap-4">
            <Compartment>
              <div className="text-center text-lg font-semibold self-center w-full">
                <div className="text-sm font-bold uppercase">Total prize pool</div>

                <div className="text-lg">{Number(formatEther(prizePool)).toFixed(2)} $LORDS</div>
              </div>
            </Compartment>
            <Compartment>
              <div className="text-center text-lg font-semibold self-center w-full">
                <div className="text-sm font-bold uppercase">Time left to register</div>
                <div className="text-lg">{timeRemaining}</div>
              </div>
            </Compartment>
          </div>

          {/* Player stats */}
          <div className="grid grid-cols-2 gap-4">
            <Compartment>
              <div className="text-center text-lg font-semibold self-center w-full">
                <div className="text-sm font-bold uppercase">Registered players</div>
                <div className="text-lg">{registeredPlayers}</div>
              </div>
            </Compartment>
            <Compartment>
              <div className="text-center text-lg font-semibold self-center w-full">
                <div className="text-sm font-bold uppercase">Season winner</div>
                <div className="text-lg">{seasonWinner}</div>
              </div>
            </Compartment>
          </div>

          <Compartment>
            <div className="text-center text-lg font-semibold self-center w-full">
              You are {registrationStatus}! You will be able to claim your rewards after the registration period ends.
            </div>
          </Compartment>

          {/* Action button */}
          <Button
            variant="primary"
            isLoading={isLoading}
            disabled={!registrationClosed && registrationStatus === "registered"}
            onClick={registrationClosed ? claimRewards : registerToLeaderboard}
          >
            {registrationClosed
              ? "Claim Rewards"
              : registrationStatus === "unregistered"
                ? "Register to Leaderboard"
                : "Wait for claim period to start"}
          </Button>
        </div>
      </div>
    </OSWindow>
  );
};

const Compartment = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col w-full justify-center border-b border-brown/50 p-4 rounded-md bg-brown/50 bg-hex m-auto h-28">
      {children}
    </div>
  );
};
