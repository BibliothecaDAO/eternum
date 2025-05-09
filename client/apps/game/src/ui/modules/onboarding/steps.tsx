import { ReactComponent as BackArrow } from "@/assets/icons/back.svg";
import { ReactComponent as Eye } from "@/assets/icons/eye.svg";
import { ReactComponent as Sword } from "@/assets/icons/sword.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { useGoToStructure, useSpectatorModeClick } from "@/hooks/helpers/use-navigate";
import { useSetAddressName } from "@/hooks/helpers/use-set-address-name";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position, Position as PositionInterface } from "@/types/position";
import {
  getUnusedSeasonPasses,
  queryRealmCount,
  SeasonPassRealm,
} from "@/ui/components/cityview/realm/settle-realm-component";
import { MintVillagePassModal } from "@/ui/components/settlement/mint-village-pass-modal";
import { SettlementMinimapModal } from "@/ui/components/settlement/settlement-minimap-modal";
import { SettlementLocation } from "@/ui/components/settlement/settlement-types";
import Button from "@/ui/elements/button";
import { getRealmsAddress, getSeasonPassAddress } from "@/utils/addresses";
import { getMaxLayer } from "@/utils/settlement";
import { useDojo, usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useAccount } from "@starknet-react/core";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { env } from "../../../../env";

export const LocalStepOne = () => {
  const {
    account: { account },
    setup: {
      systemCalls: { mint_and_settle_test_realm },
    },
  } = useDojo();
  const [selectedLocation, setSelectedLocation] = useState<SettlementLocation | null>(null);
  const [realmId, setRealmId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [maxLayers, setMaxLayers] = useState<number | null>(null); // Default to 5 layers

  useEffect(() => {
    const fetchRealmCount = async () => {
      setLoading(true);
      try {
        const count = await queryRealmCount();

        if (count !== null) {
          const maxLayer = getMaxLayer(count);
          setMaxLayers(maxLayer);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching realm count:", error);
      }
    };

    fetchRealmCount();
  }, []);

  const toggleModal = useUIStore((state) => state.toggleModal);

  const random = Math.floor(Math.random() * 8000);

  const handleMintAndPrepare = async () => {
    setRealmId(random);
    handleSelectLocationClick();
  };

  const handleSettleRealm = async () => {
    if (!realmId || !selectedLocation) return;

    setLoading(true);
    try {
      await mint_and_settle_test_realm({
        token_id: realmId,
        signer: account,
        realms_address: getRealmsAddress(),
        season_pass_address: getSeasonPassAddress(),
        realm_settlement: {
          side: selectedLocation.side,
          layer: selectedLocation.layer,
          point: selectedLocation.point,
        },
      });
      setSelectedLocation(null);
      setLoading(false);
    } catch (error) {
      console.error("Error creating realms:", error);
      setLoading(false);
    }
  };

  const handleLocationSelect = (location: SettlementLocation) => {
    setSelectedLocation(location);
  };

  const handleConfirmLocation = () => {
    toggleModal(null); // Close the modal
  };

  const handleSelectLocationClick = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent triggering the parent onClick
    }
    if (!maxLayers) return;

    toggleModal(
      <SettlementMinimapModal
        onSelectLocation={handleLocationSelect}
        onConfirm={handleConfirmLocation}
        maxLayers={maxLayers}
        realmId={realmId || random}
        realmName="Your New Realm"
      />,
    );
  };

  const selectedCoords = useMemo(() => {
    if (!selectedLocation) return null;
    const normalizedCoords = new PositionInterface({
      x: selectedLocation.x,
      y: selectedLocation.y,
    }).getNormalized();
    return normalizedCoords;
  }, [selectedLocation]);

  const handleVillagePassClick = () => {
    console.log("Village pass clicked");
    toggleModal(<MintVillagePassModal onClose={() => toggleModal(null)} />);
  };

  return (
    <>
      {selectedLocation ? (
        <div className="w-full">
          <div className="mt-4 flex flex-col gap-2">
            <div className="text-center text-gold">
              Selected Coordinates: {selectedCoords?.x}, {selectedCoords?.y}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSelectLocationClick}
                disabled={loading}
                className="flex-1 h-8 md:h-12 lg:h-10 2xl:h-12 !text-gold !bg-gold/20 !normal-case rounded-md"
              >
                <div className="flex items-center">
                  <BackArrow className="!w-5 !h-5 mr-1 md:mr-2 fill-gold text-gold" />
                  Change Location
                </div>
              </Button>
              <Button
                onClick={handleSettleRealm}
                disabled={loading}
                className="flex-1 h-8 md:h-12 lg:h-10 2xl:h-12 !text-brown !bg-gold !normal-case rounded-md"
              >
                <div className="flex items-center justify-center">
                  {loading ? (
                    <img src="/images/logos/eternum-loader.png" className="w-5 h-5 mr-1 md:mr-2" />
                  ) : (
                    <TreasureChest className="!w-5 !h-5 mr-1 md:mr-2 fill-brown text-brown" />
                  )}
                  {loading ? "Processing..." : "Confirm Settlement"}
                </div>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          onClick={handleMintAndPrepare}
          disabled={loading}
          className={`mt-8 w-full h-8 md:h-12 lg:h-10 2xl:h-12 !text-brown !bg-gold !normal-case rounded-md hover:scale-105 hover:-translate-y-1 ${loading ? "" : "animate-pulse"}`}
        >
          <div className="flex items-center">
            {loading ? (
              <img src="/images/logos/eternum-loader.png" className="w-5 h-5 mr-1 md:mr-2" />
            ) : (
              <TreasureChest className="!w-5 !h-5 mr-1 md:mr-2 fill-brown text-brown" />
            )}
            {loading ? "Processing..." : "Settle Realm"}
          </div>
        </Button>
      )}
      <Button
        onClick={handleVillagePassClick}
        className={`${loading ? "" : "animate-pulse"} mt-8 w-full h-8 md:h-12 lg:h-10 2xl:h-12 !text-brown !bg-gold !normal-case rounded-md hover:scale-105 hover:-translate-y-1`}
      >
        <div className="flex items-center gap-2">
          <TreasureChest className="!w-4 !h-4 fill-brown text-brown" />
          Get Village
        </div>
      </Button>
    </>
  );
};

export const StepOne = () => {
  const {
    setup: { components },
    account: { account },
    setup,
  } = useDojo();
  const hasAcceptedToS = useUIStore((state) => state.hasAcceptedToS);
  const setShowToS = useUIStore((state) => state.setShowToS);
  const { connector } = useAccount();

  const realmEntities = usePlayerOwnedRealmEntities();

  const villageEntities = usePlayerOwnedVillageEntities();

  const hasRealmsOrVillages = useMemo(() => {
    return realmEntities.length > 0 || villageEntities.length > 0;
  }, [realmEntities, villageEntities]);

  const isSeasonActive = env.VITE_PUBLIC_SEASON_START_TIME <= Date.now() / 1000;
  const canPlay = hasRealmsOrVillages && isSeasonActive;

  // Only set address name if user has realms or villages
  useSetAddressName(setup, hasRealmsOrVillages ? account : null, connector);

  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now() / 1000;
      const timeLeft = env.VITE_PUBLIC_SEASON_START_TIME - now;

      if (timeLeft <= 0) {
        setTimeRemaining("");
        return;
      }

      const days = Math.floor(timeLeft / (60 * 60 * 24));
      const hours = Math.floor((timeLeft % (60 * 60 * 24)) / (60 * 60));
      const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
      const seconds = Math.floor(timeLeft % 60);
      const time = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      setTimeRemaining(time);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  const onSpectatorModeClick = useSpectatorModeClick(components);
  const goToStructure = useGoToStructure();

  const onPlayModeClick = () => {
    const randomRealmEntityOrVillageEntity =
      realmEntities.length > 0 ? realmEntities[0] : villageEntities.length > 0 ? villageEntities[0] : undefined;

    const structure = randomRealmEntityOrVillageEntity
      ? getComponentValue(components.Structure, randomRealmEntityOrVillageEntity)
      : undefined;

    if (!structure) return;
    goToStructure(structure.entity_id, new Position({ x: structure.base.coord_x, y: structure.base.coord_y }), false);
  };

  return (
    <div className="flex flex-row justify-center space-y-4 items-center flex-wrap">
      {hasAcceptedToS ? (
        <Button
          size="lg"
          variant="gold"
          disabled={!canPlay}
          className={` w-full ${!canPlay ? "opacity-40 hover:none disabled:pointer-events-none" : ""}`}
          onClick={onPlayModeClick}
        >
          <Sword className="w-6 fill-current mr-2" />
          <div className="text-black flex-grow text-center">{isSeasonActive ? "Play Eternum" : timeRemaining}</div>
        </Button>
      ) : (
        <Button size="lg" className="!bg-gold border-none w-full" onClick={() => setShowToS(true)}>
          <div className="text-black flex-grow text-center">Accept ToS</div>
        </Button>
      )}
      {/* <SpectateButton onClick={onSpectatorModeClick} /> */}
    </div>
  );
};

export const SpectateButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button className="w-full" onClick={onClick} size="lg">
      <div className="flex items-center justify-start w-full">
        <Eye className="w-6 fill-current mr-2" /> <div className="flex-grow text-center">Spectate</div>
      </div>
    </Button>
  );
};

export const SettleRealm = ({ onPrevious }: { onPrevious: () => void }) => {
  const {
    account: { account },
    setup: {
      components: { Structure },
    },
  } = useDojo();

  const realms = usePlayerOwnedRealmEntities();

  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRealms, setSelectedRealms] = useState<number[]>([]);
  const [seasonPassRealms, setSeasonPassRealms] = useState<SeasonPassRealm[]>([]);

  useEffect(() => {
    const fetchPasses = async () => {
      try {
        const unsettledSeasonPassRealms = await getUnusedSeasonPasses(
          account.address,
          realms.map((entity) => getComponentValue(Structure, entity)?.metadata.realm_id || 0),
        );
        setSeasonPassRealms(unsettledSeasonPassRealms);
        if (unsettledSeasonPassRealms.length === 0) {
          onPrevious();
        }
      } catch (error) {
        console.error("Error fetching unused season passes:", error);
      }
    };

    fetchPasses();
  }, [account.address, realms, Structure, onPrevious]);

  const handleSelectLocation = (realmId: number, location: SettlementLocation | null) => {
    setSeasonPassRealms((prevRealms) =>
      prevRealms.map((realm) => (realm.realmId === realmId ? { ...realm, selectedLocation: location } : realm)),
    );
    if (location !== null) {
      setSelectedRealms((prevSelectedRealms) => {
        if (!prevSelectedRealms.includes(realmId)) {
          return [...prevSelectedRealms, realmId];
        }
        return prevSelectedRealms;
      });
    }
  };

  const occupiedLocations = useMemo(() => {
    return seasonPassRealms
      .filter((realm) => realm.selectedLocation !== undefined && realm.selectedLocation !== null)
      .map((realm) => realm.selectedLocation!)
      .filter((location): location is SettlementLocation => location !== null && location !== undefined);
  }, [seasonPassRealms]);

  const [realmCount, setRealmCount] = useState<number>(0);
  const [maxLayers, setMaxLayers] = useState<number | null>(null);

  useEffect(() => {
    setMaxLayers(getMaxLayer(realmCount));
  }, [realmCount]);

  useEffect(() => {
    const fetchRealmCount = async () => {
      setRealmCount((await queryRealmCount()) ?? 0);
    };
    fetchRealmCount();
  }, []);

  const seasonPassElements = useMemo(() => {
    return seasonPassRealms.map((seasonPassElement) => (
      <SeasonPassRealm
        key={seasonPassElement.realmId}
        seasonPassRealm={seasonPassElement}
        selected={selectedRealms.includes(seasonPassElement.realmId)}
        setSelected={(selected) =>
          setSelectedRealms(
            selected
              ? [...selectedRealms, seasonPassElement.realmId]
              : selectedRealms.filter((id) => id !== seasonPassElement.realmId),
          )
        }
        onSelectLocation={handleSelectLocation}
        occupiedLocations={occupiedLocations}
        realmCount={realmCount}
        maxLayers={maxLayers}
      />
    ));
  }, [seasonPassRealms, selectedRealms, handleSelectLocation, occupiedLocations, realmCount, maxLayers]);

  return (
    <motion.div
      className="flex justify-center z-50 px-4 md:px-0 flex-col "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 20 }}
      exit={{ opacity: 0 }}
      transition={{ type: "ease-in-out", stiffness: 3, duration: 0.2 }}
    >
      {seasonPassRealms.length === 0 && !loading ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-gold">No Realms</h3>
          <p className="text-gray-400">You need to have at least one realm to settle a season pass.</p>
          <Button size="lg" onClick={onPrevious}>
            Go Back
          </Button>
        </div>
      ) : (
        <div
          className={`self-center border-[0.5px] border-gradient rounded-lg w-full relative z-50 backdrop-filter
		 p-8`}
        >
          <div className="relative flex flex-col gap-6 min-h-full h-full max-h-full">
            <Header onPrevious={onPrevious} />

            <div className="relative flex flex-col gap-3 overflow-hidden overflow-y-auto h-full no-scrollbar pb-24">
              {loading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-md">
                  <img src="/images/logos/eternum-loader.png" className="w-10 h-10 animate-spin" alt="Loading..." />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">{seasonPassElements}</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const Header = ({ onPrevious }: { onPrevious: () => void }) => {
  return (
    <div className="justify-between items-center">
      <div className="flex w-full gap-2">
        {" "}
        <Button size="xs" variant="primary" className="self-center" onClick={onPrevious}>
          <BackArrow className="w-4 h-4 mr-2 fill-current" />
          <div className="w-14 text-base font-normal normal-case inline">Back</div>
        </Button>
        <h3 className="self-center ml-9">Season Pass</h3>
      </div>
      <p className="text-xl mt-3">
        Tip: During settling, other people might settle in the same location as you at the same time, which will result
        in an error. If you have an error, try settling again.
      </p>
    </div>
  );
};
