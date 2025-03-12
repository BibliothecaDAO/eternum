import { ReactComponent as BackArrow } from "@/assets/icons/back.svg";
import { ReactComponent as CheckboxMinus } from "@/assets/icons/checkbox-minus.svg";
import { ReactComponent as CheckboxUnchecked } from "@/assets/icons/checkbox-unchecked.svg";
import { ReactComponent as Eye } from "@/assets/icons/eye.svg";
import { ReactComponent as Sword } from "@/assets/icons/sword.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { useNavigateToHexView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { getUnusedSeasonPasses, SeasonPassRealm } from "@/ui/components/cityview/realm/settle-realm-component";
import Button from "@/ui/elements/button";
import { OnboardingButton } from "@/ui/layouts/onboarding-button";
import { getRealmsAddress, getSeasonPassAddress } from "@/utils/addresses";
import { getRandomRealmEntity } from "@/utils/realms";
import { useDojo, usePlayerOwnedRealms } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { env } from "../../../../env";

export const LocalStepOne = () => {
  const {
    account: { account },
    setup: {
      systemCalls: { mint_test_realm, mint_season_passes, create_multiple_realms },
    },
  } = useDojo();
  console.log(getSeasonPassAddress());

  const random = Math.floor(Math.random() * 8000);
  return (
    <Button
      onClick={async () => {
        try {
          await mint_test_realm({
            token_id: random,
            signer: account,
            realms_address: getRealmsAddress(),
          });
        } catch (error) {
          console.error("Error minting test realm:", error);
          return; // Exit early if first step fails
        }

        try {
          await mint_season_passes({
            recipient: account.address,
            token_ids: [random],
            signer: account,
            season_pass_address: getSeasonPassAddress(),
          });
        } catch (error) {
          console.error("Error minting season passes:", error);
          return; // Exit early if second step fails
        }

        try {
          await create_multiple_realms({
            realm_ids: [random],
            owner: account.address,
            frontend: account.address,
            signer: account,
            season_pass_address: getSeasonPassAddress(),
          });
        } catch (error) {
          console.error("Error creating realms:", error);
          // TODO: Show error toast/notification to user
        }
      }}
      className={`mt-8 w-full h-8 md:h-12 lg:h-10 2xl:h-12 !text-brown !bg-gold !normal-case rounded-md hover:scale-105 hover:-translate-y-1 animate-pulse`}
    >
      <div className="flex items-center">
        <TreasureChest className="!w-5 !h-5 mr-1 md:mr-2 fill-brown text-brown" />
        Settle Realm
      </div>
    </Button>
  );
};

export const StepOne = () => {
  const {
    setup: { components },
  } = useDojo();
  const hasAcceptedToS = useUIStore((state) => state.hasAcceptedToS);
  const setShowToS = useUIStore((state) => state.setShowToS);

  const realms = usePlayerOwnedRealms();

  const navigateToHexView = useNavigateToHexView();

  const onSpectatorModeClick = () => {
    const randomRealmEntity = getRandomRealmEntity(components);
    const structure = randomRealmEntity ? getComponentValue(components.Structure, randomRealmEntity) : undefined;
    structure && navigateToHexView(new Position({ x: structure.base.coord_x, y: structure.base.coord_y }));
  };

  const onPlayModeClick = () => {
    const realmPosition = new Position(realms[0]?.position);
    navigateToHexView(realmPosition);
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
      await create_multiple_realms({
        realm_ids: realmIds,
        owner: account.address,
        frontend: env.VITE_PUBLIC_CLIENT_FEE_RECIPIENT,
        signer: account,
        season_pass_address: getSeasonPassAddress(),
      });
      setSelectedRealms([]);
      onPrevious();
    } catch (error) {
      console.error("Error settling realms:", error);
      setLoading(false);
    }
  };

  const realms = usePlayerOwnedRealms();

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
              <img src="/images/logos/eternum-animated.png" className="w-7" />
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
