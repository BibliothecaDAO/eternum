import { ReactComponent as BackArrow } from "@/assets/icons/back.svg";
import { ReactComponent as CheckboxMinus } from "@/assets/icons/checkbox-minus.svg";
import { ReactComponent as CheckboxUnchecked } from "@/assets/icons/checkbox-unchecked.svg";
import { ReactComponent as Eye } from "@/assets/icons/eye.svg";
import { ReactComponent as Sword } from "@/assets/icons/sword.svg";

import { useDojo } from "@/hooks/context/DojoContext";
import { useQuery } from "@/hooks/helpers/useQuery";
import { usePlayerRealms } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import { Position } from "@/types/Position";
import { getUnusedSeasonPasses, SeasonPassRealm } from "@/ui/components/cityview/realm/SettleRealmComponent";
import Button from "@/ui/elements/Button";
import { useEffect, useMemo, useState } from "react";
import { env } from "../../../../env";

export const ACCOUNT_CHANGE_EVENT = "addressChanged";

import { OnboardingButton } from "@/ui/layouts/OnboardingButton";
import { motion } from "framer-motion";

export const StepOne = () => {
  const setSpectatorMode = useUIStore((state) => state.setSpectatorMode);
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const hasAcceptedToS = useUIStore((state) => state.hasAcceptedToS);
  const setShowToS = useUIStore((state) => state.setShowToS);

  const { handleUrlChange } = useQuery();

  const realms = usePlayerRealms();

  const onSpectatorModeClick = () => {
    setIsLoadingScreenEnabled(true);
    setSpectatorMode(true);
    setTimeout(() => {
      showBlankOverlay(false);
      handleUrlChange(new Position({ x: 0, y: 0 }).toMapLocationUrl());
      window.dispatchEvent(new Event(ACCOUNT_CHANGE_EVENT));
    }, 250);
  };

  const playUrl = useMemo(() => {
    if (realms.length <= 0) {
      return;
    }
    return new Position(realms[0]?.position).toHexLocationUrl();
  }, [realms]);

  const onPlayModeClick = () => {
    setIsLoadingScreenEnabled(true);
    showBlankOverlay(false);
    handleUrlChange(playUrl!);
    window.dispatchEvent(new Event(ACCOUNT_CHANGE_EVENT));
  };

  return (
    <div className="flex flex-row justify-center space-x-8 items-center">
      <SpectateButton onClick={onSpectatorModeClick} />
      {hasAcceptedToS ? (
        <OnboardingButton
          disabled={realms.length <= 0}
          className={`!bg-gold border-none ${
            realms.length <= 0 ? "opacity-40 hover:none disabled:pointer-events-none" : ""
          }`}
          onClick={onPlayModeClick}
        >
          <Sword className="w-6 fill-current mr-2" /> <div className="text-black">Play</div>
        </OnboardingButton>
      ) : (
        <OnboardingButton className="!bg-gold border-none" onClick={() => setShowToS(true)}>
          <div className="text-black">Accept ToS</div>
        </OnboardingButton>
      )}
    </div>
  );
};

export const SpectateButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <OnboardingButton onClick={onClick} className="hover:!bg-gold/20">
      <Eye className="w-4 fill-current mr-2" /> <div>Spectate</div>
    </OnboardingButton>
  );
};

export const SettleRealm = ({ onPrevious }: { onPrevious: () => void }) => {
  const {
    account: { account },
    setup: {
      systemCalls: { create_multiple_realms },
    },
  } = useDojo();

  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRealms, setSelectedRealms] = useState<number[]>([]);

  const [seasonPassRealms, setSeasonPassRealms] = useState<SeasonPassRealm[]>([]);

  const settleRealms = async (realmIds: number[]) => {
    setLoading(true);
    try {
      const res = await create_multiple_realms({
        realm_ids: realmIds,
        owner: account.address,
        frontend: env.VITE_PUBLIC_CLIENT_FEE_RECIPIENT,
        signer: account,
        season_pass_address: env.VITE_SEASON_PASS_ADDRESS,
      });
      setSelectedRealms([]);
      onPrevious();
    } catch (error) {
      console.error("Error settling realms:", error);
      setLoading(false);
    }
  };

  const realms = usePlayerRealms();

  useEffect(() => {
    getUnusedSeasonPasses(account.address, realms).then((unsettledSeasonPassRealms) => {
      if (unsettledSeasonPassRealms.length !== seasonPassRealms.length) {
        setSeasonPassRealms(unsettledSeasonPassRealms);
        setLoading(false);
      }
    });
  }, [loading, realms]);

  const seasonPassElements = useMemo(() => {
    const elements = [];
    for (let i = 0; i < seasonPassRealms.length; i += 2) {
      const seasonPassElement = seasonPassRealms[i];
      const seasonPassElement2 = seasonPassRealms[i + 1];
      elements.push(
        <div className="grid grid-cols-2 gap-3">
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
          />
          {seasonPassElement2 && (
            <SeasonPassRealm
              key={seasonPassElement2.realmId}
              seasonPassRealm={seasonPassElement2}
              selected={selectedRealms.includes(seasonPassElement2.realmId)}
              setSelected={(selected) =>
                setSelectedRealms(
                  selected
                    ? [...selectedRealms, seasonPassElement2.realmId]
                    : selectedRealms.filter((id) => id !== seasonPassElement2.realmId),
                )
              }
            />
          )}
        </div>,
      );
    }
    return elements;
  }, [seasonPassRealms, selectedRealms]);

  const width = "max-w-[600px] w-[40vw]";
  const height = "max-h-[500px] h-[46vh] xl:h-[52vh] 2xl:h-[46vh]";
  const size = `${width} ${height}`;

  return (
    <motion.div
      className="flex justify-center z-50 px-4 md:px-0 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 20 }}
      exit={{ opacity: 0 }}
      transition={{ type: "ease-in-out", stiffness: 3, duration: 0.2 }}
    >
      <div
        className={`backdrop-blur-lg bg-black/20 self-center border-[0.5px] border-gradient rounded-lg text-gold w-full overflow-hidden relative z-50 backdrop-filter backdrop-blur-[24px] ${size} 
		shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] p-8`}
      >
        <div className="relative flex flex-col gap-6 min-h-full h-full max-h-full">
          <Header onPrevious={onPrevious} />

          <div className="flex flex-row justify-between ml-1 relative top-2">
            {selectedRealms.length === 0 ? (
              <div
                className="flex flex-row items-center gap-2"
                onClick={() => setSelectedRealms(seasonPassRealms.map((realm) => realm.realmId))}
              >
                <CheckboxUnchecked className="w-4 h-4 fill-current text-gold" />
                <div className="text-sm">{seasonPassRealms.length} Available</div>
              </div>
            ) : (
              <div className="flex flex-row items-center gap-2" onClick={() => setSelectedRealms([])}>
                <CheckboxMinus className="w-4 h-4 fill-current text-gold" />
                <div className="text-sm">
                  {selectedRealms.length} / {seasonPassRealms.length} Selected
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 lg:h-[22vh] lg:max-h-[22vh] lg:min-h-[22vh] min-h-[20vh] h-[20vh] max-h-[20vh] xl:h-[20vh] xl:max-h-[20vh] xl:min-h-[20vh] 2xl:h-[22vh] 2xl:max-h-[22vh] 2xl:min-h-[22vh] overflow-hidden overflow-y-auto no-scrollbar">
            {seasonPassElements}
          </div>
          <Button
            disabled={selectedRealms.length === 0 || loading}
            onClick={() => settleRealms(selectedRealms)}
            className={`absolute bottom-0 w-full lg:h-10 h-12 !text-black !normal-case rounded-md ${
              selectedRealms.length <= 0 || loading
                ? "opacity-50 !bg-gold/50 hover:scale-100 hover:translate-y-0 cursor-not-allowed"
                : "!bg-gold hover:!bg-gold/80"
            }`}
          >
            {loading ? (
              <img src="/images/eternum-logo_animated.png" className="w-7" />
            ) : (
              <div className="text-lg !font-normal">{`Settle ${
                selectedRealms.length > 0 ? `(${selectedRealms.length})` : ""
              }`}</div>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

const Header = ({ onPrevious }: { onPrevious: () => void }) => {
  return (
    <div className="grid grid-cols-3 justify-between items-center">
      <Button
        className="!h-12 !w-24 !bg-gold/10 !border-none hover:scale-105 hover:-translate-y-1 !px-3 !shadow-none hover:text-gold"
        variant="primary"
        onClick={onPrevious}
      >
        <BackArrow className="w-6 h-6 mr-2 fill-current" />
        <div className="w-14 text-base font-normal normal-case inline">Back</div>
      </Button>
      <div className="text-2xl font-normal normal-case mx-auto self-center">Season Pass</div>
      <div className="w-14"></div>
    </div>
  );
};
