import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { rewards } from "@/ui/components/navigation/config";
import { OSWindow } from "@/ui/components/navigation/os-window";
import Button from "@/ui/elements/button";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { getLordsAddress } from "@/utils/addresses";
import { formatTime, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo, usePrizePool } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { shortString } from "starknet";
import { formatEther } from "viem";

const REGISTRATION_DELAY = 60 * 60 * 24 * 4; // 4 days
const BRIDGE_OUT_DELAY = 60 * 60 * 24 * 2; // 2 days

export const Rewards = () => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { claim_construction_points, claim_share_points, end_game, season_prize_claim },
    },
  } = useDojo();

  const {
    AddressName,
    PlayerRegisteredPoints,
    events: { SeasonEnded },
    Hyperstructure,
  } = components;

  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [registrationTimeRemaining, setRegistrationTimeRemaining] = useState<string>("");
  const [bridgeOutTimeRemaining, setBridgeOutTimeRemaining] = useState<string>("");

  const [lordsAddress, setLordsAddress] = useState<string | undefined>();

  const hyperstructure_entities = useEntityQuery([Has(Hyperstructure)]);

  const hyperstructure_ids = useMemo(() => {
    return hyperstructure_entities
      .map((entity) => getComponentValue(Hyperstructure, entity)?.hyperstructure_id)
      .filter((id) => id !== undefined);
  }, [hyperstructure_entities]);

  useEffect(() => {
    const init = async () => {
      const address = getLordsAddress();
      setLordsAddress(address as string);
    };
    init();
  }, []);

  const gameEndedEntities = useEntityQuery([Has(SeasonEnded)]);

  const gameEnded = useMemo(() => {
    if (gameEndedEntities.length === 0) return undefined;
    return getComponentValue(SeasonEnded, gameEndedEntities[0]);
  }, [gameEndedEntities]);

  const prizePool = usePrizePool(lordsAddress);
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(rewards));

  const playerRegistredPoints = useComponentValue(
    PlayerRegisteredPoints,
    getEntityIdFromKeys([ContractAddress(account.address)]),
  );

  const claimRewards = useCallback(async () => {
    setIsLoading(true);
    try {
      await season_prize_claim({
        signer: account,
      });
    } catch (error) {
      console.error("Error claiming rewards", error);
    } finally {
      setIsLoading(false);
    }
    setIsLoading(false);
  }, [account]);

  const claimConstructionPoints = useCallback(async () => {
    setIsLoading(true);
    try {
      await claim_construction_points({
        hyperstructure_ids,
        player: account.address,
        signer: account,
      });
    } catch (error) {
      console.error("Error claiming construction points", error);
    } finally {
      setIsLoading(false);
    }
  }, [account, hyperstructure_ids]);

  const claimSharePoints = useCallback(async () => {
    setIsLoading(true);
    try {
      await claim_share_points({
        hyperstructure_ids,
        signer: account,
      });
    } catch (error) {
      console.error("Error claiming share points", error);
    } finally {
      setIsLoading(false);
    }
  }, [account, hyperstructure_ids]);

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
          setRegistrationTimeRemaining(formatTime(registrationDifference));
        }

        // Calculate bridge out time
        if (currentTime >= bridgeOutEndTime) {
          setBridgeOutTimeRemaining("Bridge Out Closed");
        } else {
          const bridgeOutDifference = bridgeOutEndTime - currentTime;
          setBridgeOutTimeRemaining(formatTime(bridgeOutDifference));
        }
      };

      calculateTimeRemaining();
      const timer = setInterval(calculateTimeRemaining, 1000);

      return () => clearInterval(timer);
    }
  }, [gameEnded]);

  const registeredPlayers = useMemo(() => {
    const registeredPlayers = runQuery([Has(PlayerRegisteredPoints)]);
    return registeredPlayers.size;
  }, [gameEnded]);

  const seasonWinner = useMemo(() => {
    if (!gameEnded) return "";
    const seasonWinner = getComponentValue(AddressName, getEntityIdFromKeys([gameEnded?.winner_address]));
    return shortString.decodeShortString(seasonWinner?.name.toString() ?? "");
  }, [gameEnded]);

  const registrationStatus = useMemo(() => {
    const registered = getComponentValue(
      PlayerRegisteredPoints,
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

                <div className="text-lg">
                  {currencyIntlFormat(Number(playerRegistredPoints?.registered_points ?? 0))}
                </div>
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

          <div className="flex flex-wrap gap-4">
            <Button variant="primary" isLoading={isLoading} disabled={!registrationClosed} onClick={claimRewards}>
              {registrationClosed ? "Claim Rewards" : "Waiting for registration period to end"}
            </Button>

            <Button variant="primary" isLoading={isLoading} onClick={claimConstructionPoints}>
              Claim Construction Points
            </Button>

            <Button variant="primary" isLoading={isLoading} onClick={claimSharePoints}>
              Claim Share Points
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
