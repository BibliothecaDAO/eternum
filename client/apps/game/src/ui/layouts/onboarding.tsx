import { ReactComponent as BackArrow } from "@/assets/icons/back.svg";
import { ReactComponent as EternumWordsLogo } from "@/assets/icons/eternum-words-logo.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { SeasonPassRealm, getUnusedSeasonPasses } from "@/ui/components/cityview/realm/settle-realm-component";
import Button from "@/ui/elements/button";
import { TermsOfService } from "@/ui/layouts/terms-of-service";
import { LocalStepOne, SettleRealm, StepOne } from "@/ui/modules/onboarding/steps";
import { useDojo, usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { env } from "../../../env";
import { MintVillagePassModal } from "../components/settlement/mint-village-pass-modal";

interface OnboardingOverlayProps {
  controller?: boolean;
}

interface StepContainerProps {
  children: React.ReactNode;
  bottomChildren?: React.ReactNode;
  tos?: boolean;
  transition?: boolean;
  loading?: boolean;
  isSettleRealm?: boolean;
}

interface OnboardingContainerProps {
  children: React.ReactNode;
  backgroundImage: string;
  controller?: boolean;
}

interface OnboardingProps {
  backgroundImage: string;
}

interface SeasonPassButtonProps {
  setSettleRealm: React.Dispatch<React.SetStateAction<boolean>>;
}

export const mintUrl =
  env.VITE_PUBLIC_CHAIN === "mainnet"
    ? "https://empire.realms.world/season-passes"
    : "https://next-empire.realms.world/season-passes";

export const StepContainer = ({
  children,
  bottomChildren,
  tos = true,
  transition = true,
  loading = false,
  isSettleRealm = false,
}: StepContainerProps) => {
  const width = "w-[456px]";
  const height = "h-screen";
  const size = `${width} ${height}`;

  const showToS = useUIStore((state) => state.showToS);
  const setShowToS = useUIStore((state) => state.setShowToS);

  const expandedWidth = showToS || isSettleRealm ? "w-[800px]" : width;

  const motionProps = transition
    ? {
        initial: { opacity: 0, x: -20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0 },
        transition: { type: "ease-in-out", stiffness: 3, duration: 0.2 },
      }
    : {};

  return (
    <motion.div className="flex h-screen z-50" {...motionProps}>
      <div
        className={`bg-black/20 border-r border-[0.5px] border-gradient p-6 lg:p-10 text-gold overflow-hidden relative z-50 backdrop-filter backdrop-blur-[32px] my-16 ml-16 panel-wood panel-wood-corners ${
          expandedWidth
        } shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]`}
      >
        {showToS ? (
          <div className="flex flex-col h-full max-h-full pb-4">
            <Button
              className="!h-12 !w-24 !bg-gold/10 !border-none hover:scale-105 hover:-translate-y-1 !px-3 !shadow-none hover:text-gold"
              variant="primary"
              onClick={() => setShowToS(false)}
            >
              <BackArrow className="w-6 h-6 mr-2 fill-current" />
              <div className="w-14 text-base font-normal normal-case inline">Back</div>
            </Button>
            <div className="w-full h-full py-1">
              <TermsOfService />
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="w-full text-center flex-shrink-0">
              <div className="mx-auto flex mb-4 sm:mb-4 lg:mb-8">
                {loading ? (
                  <img
                    src="/images/logos/eternum-loader.png"
                    className="w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2 mx-auto my-8"
                  />
                ) : (
                  <EternumWordsLogo className="fill-brown w-32 sm:w-40 lg:w-72 mx-auto" />
                )}
              </div>
            </div>
            <div className="flex-grow overflow-auto">{children}</div>
            {tos && (
              <div className="mt-auto pt-4 flex-shrink-0">
                <div className="relative w-full">{!isSettleRealm && bottomChildren}</div>
                <div className="w-full flex justify-center rounded-lg p-2">
                  <p className="text-xxs align-bottom my-auto ml-2 text-center" onClick={() => setShowToS(true)}>
                    By continuing you are agreeing to Eternum's{" "}
                    <span className="inline underline">Terms of Service</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const OnboardingContainer = ({ children, backgroundImage, controller = true }: OnboardingContainerProps) => (
  <div className="relative min-h-screen w-full pointer-events-auto">
    <img
      className="absolute h-screen w-screen object-cover"
      src={`/images/covers/${backgroundImage}.png`}
      alt="Cover"
    />
    <div className="absolute z-10 w-screen h-screen">
      {/* <OnboardingOverlay controller={controller} /> */}
      {children}
    </div>
  </div>
);

export const Onboarding = ({ backgroundImage }: OnboardingProps) => {
  const [settleRealm, setSettleRealm] = useState(false);
  const bottomChildren = useMemo(() => {
    if (env.VITE_PUBLIC_CHAIN === "local") {
      return <LocalStepOne />;
    }
    return <SeasonPassButton setSettleRealm={setSettleRealm} />;
  }, [setSettleRealm]);

  return (
    <>
      {settleRealm ? (
        <OnboardingContainer backgroundImage={backgroundImage}>
          <StepContainer bottomChildren={bottomChildren} isSettleRealm={true}>
            <SettleRealm onPrevious={() => setSettleRealm(false)} />
          </StepContainer>
        </OnboardingContainer>
      ) : (
        <OnboardingContainer backgroundImage={backgroundImage}>
          <StepContainer bottomChildren={bottomChildren}>
            <StepOne />
          </StepContainer>
        </OnboardingContainer>
      )}
    </>
  );
};

const SeasonPassButton = ({ setSettleRealm }: SeasonPassButtonProps) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();
  const { Structure } = components;

  const hasAcceptedToS = useUIStore((state) => state.hasAcceptedToS);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const [seasonPassRealms, setSeasonPassRealms] = useState<SeasonPassRealm[]>([]);
  const realmsEntities = usePlayerOwnedRealmEntities();
  const villageEntities = usePlayerOwnedVillageEntities();

  useEffect(() => {
    const fetchSeasonPasses = async () => {
      const unsettledSeasonPassRealms = await getUnusedSeasonPasses(
        account.address,
        realmsEntities.map((entity) => getComponentValue(Structure, entity)?.metadata.realm_id || 0),
      );
      setSeasonPassRealms(unsettledSeasonPassRealms);
    };
    fetchSeasonPasses();
  }, [realmsEntities, account.address]);

  const hasRealmsOrVillages = useMemo(() => {
    return realmsEntities.length > 0 || villageEntities.length > 0;
  }, [realmsEntities, villageEntities]);

  const handleVillagePassClick = () => {
    toggleModal(<MintVillagePassModal onClose={() => toggleModal(null)} />);
  };

  const handleClick = seasonPassRealms.length > 0 ? () => setSettleRealm((prev) => !prev) : undefined;
  return (
    hasAcceptedToS && (
      <div className="space-y-4">
        {seasonPassRealms.length > 0 && (
          <Button
            isPulsing={true}
            size="lg"
            onClick={handleClick}
            className={`w-full !text-black !bg-gold !normal-case rounded-md hover:scale-105 hover:-translate-y-1 transition-all duration-300 shadow-md ${
              !hasRealmsOrVillages ? "animate-pulse" : ""
            }`}
          >
            <div className="flex items-center justify-center">
              <div className="w-7 h-7 bg-black/20 rounded-full mr-2 md:mr-3 flex justify-center items-center font-semibold">
                {seasonPassRealms.length}
              </div>
              <span className="text-lg font-medium">Redeem Season Pass</span>
            </div>
          </Button>
        )}
        <div className="flex flex-col gap-3 w-full">
          <div className="flex gap-3 w-full flex-wrap">
            <a
              className="text-brown cursor-pointer w-full"
              href={`https://empire.realms.world/mint`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                className={`w-full !text-brown !bg-gold !normal-case rounded-md hover:scale-105 hover:-translate-y-1 transition-all duration-300 shadow-md ${
                  !hasRealmsOrVillages ? "animate-pulse" : ""
                }`}
              >
                <div className="flex items-center justify-center">
                  <TreasureChest className="!w-5 !h-5 mr-2 fill-brown text-brown" />
                  <span className="font-medium">Mint Season Pass</span>
                </div>
              </Button>
            </a>
            <a
              className="text-brown cursor-pointer w-full"
              href={`https://empire.realms.world/trade`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                className={`w-full !normal-case rounded-md hover:scale-105 hover:-translate-y-1 transition-all duration-300 shadow-md ${
                  !hasRealmsOrVillages ? "animate-pulse" : ""
                }`}
              >
                <div className="flex items-center justify-center">
                  <TreasureChest className="!w-5 !h-5 mr-2 fill-gold" />
                  <span className="font-medium">Buy Season Pass</span>
                </div>
              </Button>
            </a>
            <a className="w-full" target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                onClick={handleVillagePassClick}
                className={`w-full hover:scale-105 hover:-translate-y-1 transition-all duration-300 shadow-md ${
                  !hasRealmsOrVillages ? "animate-pulse" : ""
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <TreasureChest className="!w-5 !h-5 fill-gold" />
                  <span className="font-medium">Buy Village</span>
                </div>
              </Button>
            </a>
          </div>
        </div>
      </div>
    )
  );
};
