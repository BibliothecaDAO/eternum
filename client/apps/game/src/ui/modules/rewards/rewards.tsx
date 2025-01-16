import { HintSection } from "@/ui/components/hints/hint-modal";
import { rewards } from "@/ui/components/navigation/config";
import { OSWindow } from "@/ui/components/navigation/os-window";
import Button from "@/ui/elements/button";
import { ContractAddress, formatTime, getEntityIdFromKeys, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo, useGetUnregisteredEpochs, usePrizePool, useUIStore } from "@bibliothecadao/react";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { shortString } from "starknet";
import { formatEther } from "viem";
import { env } from "../../../../env";

const REGISTRATION_DELAY = 60 * 60 * 24 * 4; // 4 days
const BRIDGE_OUT_DELAY = 60 * 60 * 24 * 2; // 2 days

export const Rewards = () => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { register_to_leaderboard, claim_leaderboard_rewards },
    },
  } = useDojo();

  const {
    LeaderboardEntry,
    LeaderboardRegistered,
    AddressName,
    events: { GameEnded },
  } = components;

  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [registrationTimeRemaining, setRegistrationTimeRemaining] = useState<string>("");
  const [bridgeOutTimeRemaining, setBridgeOutTimeRemaining] = useState<string>("");

  const prizePool = usePrizePool({ viteLordsAddress: env.VITE_LORDS_ADDRESS });
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(rewards));

  const leaderboardManager = useMemo(() => {
    return LeaderboardManager.instance(components);
  }, [components]);

  const getUnregisteredEpochs = useGetUnregisteredEpochs();

  const gameEndedEntityId = useEntityQuery([Has(GameEnded)]);

  const leaderboardEntry = useComponentValue(LeaderboardEntry, getEntityIdFromKeys([ContractAddress(account.address)]));

  const gameEnded = useMemo(() => {
    return getComponentValue(GameEnded, gameEndedEntityId[0]);
  }, [gameEndedEntityId]);

  const registerToLeaderboard = useCallback(async () => {
    setIsLoading(true);
    const epochs = getUnregisteredEpochs();
    const contributions = leaderboardManager.getPlayerUnregistredContributions(ContractAddress(account.address));

    try {
      await register_to_leaderboard({
        signer: account,
        hyperstructure_contributed_to: contributions,
        hyperstructure_shareholder_epochs: epochs,
      });
    } catch (error) {
      console.error("Error registering to leaderboard", error);
    } finally {
      setIsLoading(false);
    }
  }, [leaderboardManager]);

  const claimRewards = useCallback(async () => {
    setIsLoading(true);
    try {
      await claim_leaderboard_rewards({
        signer: account,
        token: env.VITE_LORDS_ADDRESS!,
      });
    } catch (error) {
      console.error("Error claiming rewards", error);
    } finally {
      setIsLoading(false);
    }
    setIsLoading(false);
  }, [account]);

  useEffect(() => {
    if (gameEnded) {
      const calculateTimeRemaining = () => {
        const currentTime = Math.floor(Date.now() / 1000);
        const registrationEndTime = Number(gameEnded.timestamp + REGISTRATION_DELAY);
        const bridgeOutEndTime = Number(gameEnded.timestamp + BRIDGE_OUT_DELAY);

        // Calculate registration time
        if (currentTime >= registrationEndTime) {
          setRegistrationTimeRemaining("Registration Closed");
        } else {
          const registrationDifference = registrationEndTime - currentTime;
          setRegistrationTimeRemaining(formatTime(registrationDifference, undefined));
        }

        // Calculate bridge out time
        if (currentTime >= bridgeOutEndTime) {
          setBridgeOutTimeRemaining("Bridge Out Closed");
        } else {
          const bridgeOutDifference = bridgeOutEndTime - currentTime;
          setBridgeOutTimeRemaining(formatTime(bridgeOutDifference, undefined));
        }
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
                <div className="text-sm font-bold uppercase">Your registered points</div>

                <div className="text-lg">{Number(leaderboardEntry?.points ?? 0)}</div>
              </div>
            </Compartment>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Compartment isCountdown>
              <div className="text-center text-lg font-semibold self-center w-full">
                <div className="text-md uppercase font-extrabold text-danger">Time left to register</div>
                <div className="text-lg">{registrationTimeRemaining}</div>
              </div>
            </Compartment>
            <Compartment isCountdown>
              <div className="text-center text-lg font-semibold self-center w-full">
                <div className="text-md font-extrabold text-danger uppercase">Time left to bridge out</div>
                <div className="text-lg">{bridgeOutTimeRemaining}</div>
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

          <div className=" flex gap-4">
            <Button variant="primary" isLoading={isLoading} disabled={!registrationClosed} onClick={claimRewards}>
              {registrationClosed ? "Claim Rewards" : "Waiting for registration period to end"}
            </Button>

            <Button
              disabled={registrationClosed}
              variant="primary"
              isLoading={isLoading}
              onClick={registerToLeaderboard}
            >
              Register to Leaderboard
            </Button>
          </div>
          {/* Action button */}
        </div>
      </div>
    </OSWindow>
  );
};

const Compartment = ({ children, isCountdown }: { children: React.ReactNode; isCountdown?: boolean }) => {
  return (
    <div
      className={`flex flex-col w-full justify-center border-b border-brown/50 p-4 rounded-md ${
        isCountdown ? "bg-brown/70" : "bg-brown/50"
      } bg-hex m-auto h-28 ${isCountdown ? "border-2 border-danger/50" : ""}`}
    >
      {children}
    </div>
  );
};
