import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Button } from "@/ui/design-system/atoms";
import { BlitzOnboarding, LocalStepOne, SettleRealm, StepOne } from "@/ui/features/progression";
import { SeasonPassRealm, getUnusedSeasonPasses } from "@/ui/features/settlement";
import { Controller } from "@/ui/modules/controller/controller";
import { getIsBlitz } from "@bibliothecadao/eternum";
import { useDojo, usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { motion } from "framer-motion";
import { Castle, FileText, MessageSquare, Twitter as TwitterIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { env } from "../../../env";

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
  env.VITE_PUBLIC_CHAIN === "mainnet" ? "https://empire.realms.world/" : "https://dev.empire.realms.world/";

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
        {/* {showToS ? (
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
        ) : ( */}
        <div className="flex flex-col h-full">
          <div className="w-full text-center flex-shrink-0">
            <div className="mx-auto flex mb-4 sm:mb-4 lg:mb-8">
              {loading ? (
                <img
                  src="/images/logos/eternum-loader.png"
                  className="w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2 mx-auto my-8"
                />
              ) : (
                <EternumWordsLogo className="fill-brown w-56 sm:w-48 lg:w-72 xl:w-96 mx-auto" />
              )}
            </div>
          </div>
          <div className="flex-grow overflow-auto">{children}</div>
          {tos && (
            <div className="mt-auto pt-4 flex-shrink-0">
              <div className="relative w-full">{!isSettleRealm && bottomChildren}</div>
              <div className="w-full flex justify-center rounded-lg pt-2">
                <p className="text-xxs align-bottom my-auto ml-2 text-center" onClick={() => setShowToS(true)}>
                  By continuing you are agreeing <br /> to Realms's{" "}
                  <span className="inline underline">Terms of Service</span>
                </p>
              </div>
            </div>
          )}
        </div>
        {/* )} */}
      </div>
    </motion.div>
  );
};

export const OnboardingContainer = ({ children, backgroundImage, controller = true }: OnboardingContainerProps) => (
  <div className="relative min-h-screen w-full pointer-events-auto">
    <img
      className="absolute h-screen w-screen object-cover"
      src={`/images/covers/blitz/${backgroundImage}.png`}
      alt="Cover"
    />
    <div className="absolute z-10 w-screen h-screen">
      {controller && (
        <div className="absolute top-4 right-4 z-50">
          <Controller />
        </div>
      )}
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

  const isBlitz = getIsBlitz();

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
          <StepContainer bottomChildren={isBlitz ? undefined : bottomChildren}>
            {isBlitz ? <BlitzOnboarding /> : <StepOne />}
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

  const hasAcceptedTS = useUIStore((state) => state.hasAcceptedTS);
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

  return (
    hasAcceptedTS && (
      <div className="space-y-4">
        {settlingStartTimeRemaining && (
          <div className="text-center text-xl">
            Settling will being in <br /> <span className="text-gold font-bold">{settlingStartTimeRemaining}</span>
          </div>
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
    )
  );
};
