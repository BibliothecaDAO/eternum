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
import { Castle, FileText, MessageSquare, Play, Twitter as TwitterIcon } from "lucide-react";
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
  env.VITE_PUBLIC_CHAIN === "mainnet" ? "https://empire.realms.world/" : "https://next-empire.realms.world/";

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
        className={`bg-black/20 border-r border-[0.5px] border-gradient p-6 text-gold overflow-hidden relative z-50 backdrop-filter backdrop-blur-[32px] my-16 ml-16 panel-wood panel-wood-corners ${
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
                  <EternumWordsLogo className="fill-brown w-32 sm:w-24 lg:w-32 xl:w-48 mx-auto" />
                )}
              </div>
            </div>
            <div className="flex-grow overflow-auto">{children}</div>
            {tos && (
              <div className="mt-auto pt-4 flex-shrink-0">
                <div className="relative w-full">{!isSettleRealm && bottomChildren}</div>
                <div className="w-full flex justify-center rounded-lg pt-2">
                  <p className="text-xxs align-bottom my-auto ml-2 text-center" onClick={() => setShowToS(true)}>
                    By continuing you are agreeing <br /> to Eternum's{" "}
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

    // initial fetch
    fetchSeasonPasses();

    // poll every 10 seconds
    const intervalId = setInterval(fetchSeasonPasses, 10_000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
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
            <div className="flex items-center justify-start w-full">
              <div className="w-7 h-7 bg-black/20 rounded-full mr-2 md:mr-3 flex justify-center items-center font-semibold">
                {seasonPassRealms.length}
              </div>
              <span className="text-lg font-medium flex-grow text-center">Redeem Season Pass</span>
            </div>
          </Button>
        )}
        <div className="flex flex-col gap-3 w-full">
          <div className="flex w-full flex-wrap">
            <a className="w-full" target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                onClick={handleVillagePassClick}
                className={`w-full !normal-case rounded-md shadow-md ${!hasRealmsOrVillages ? "animate-pulse" : ""}`}
              >
                <div className="flex items-center justify-start w-full gap-2">
                  <Play className="!w-5 !h-5 fill-gold" />
                  <span className="font-medium flex-grow text-center">Village Pass ($5)</span>
                </div>
              </Button>
            </a>
            <a
              className="text-brown cursor-pointer w-full"
              href={`${mintUrl}trade`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                className={`w-full !normal-case rounded-md shadow-md ${!hasRealmsOrVillages ? "animate-pulse" : ""}`}
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
                className={`w-full !normal-case rounded-md shadow-md ${!hasRealmsOrVillages ? "animate-pulse" : ""}`}
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
            <Button size="lg" className="w-full !normal-case rounded-md shadow-md">
              <div className="flex items-center justify-start w-full">
                <MessageSquare className="!w-5 !h-5 mx-auto fill-gold" />
              </div>
            </Button>
          </a>
          <a
            className="text-brown cursor-pointer w-full"
            href="https://x.com/RealmsEternum"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" className="w-full !normal-case rounded-md shadow-md">
              <div className="flex items-center justify-start w-full">
                <TwitterIcon className="!w-5 !h-5 mx-auto fill-gold" />
              </div>
            </Button>
          </a>
          <a
            className="text-brown cursor-pointer w-full"
            href="https://eternum-docs.realms.world/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" className="w-full !normal-case rounded-md shadow-md">
              <div className="flex items-center w-full">
                <FileText className="!w-5 !h-5 mx-auto fill-gold" />
              </div>
            </Button>
          </a>
        </div>
      </div>
    )
  );
};
