import { ReactComponent as BackArrow } from "@/assets/icons/back.svg";
import { ReactComponent as EternumWordsLogo } from "@/assets/icons/eternum_words_logo.svg";
import { ReactComponent as Lock } from "@/assets/icons/lock.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { usePlayerRealms } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { env } from "../../../env";
import { getUnusedSeasonPasses, SeasonPassRealm } from "../components/cityview/realm/SettleRealmComponent";
import { Controller } from "../modules/controller/Controller";
import { SettleRealm, StepOne } from "../modules/onboarding/Steps";
import { formatTime } from "../utils/utils";
import { TermsOfService } from "./TermsOfService";

interface OnboardingOverlayProps {
  controller?: boolean;
}

interface StepContainerProps {
  children: React.ReactNode;
  bottomChildren?: React.ReactNode;
  tos?: boolean;
  transition?: boolean;
  loading?: boolean;
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

const SEASON_PASS_MARKET_URL = "0x057675b9c0bd62b096a2e15502a37b290fa766ead21c33eda42993e48a714b80";

const OnboardingOverlay = ({ controller }: OnboardingOverlayProps) => {
  const mintUrl = env.VITE_PUBLIC_DEV
    ? "https://empire-next.realms.world/season-passes"
    : "https://empire.realms.world/season-passes";

  return (
    <div className="fixed top-6 right-6 flex justify-center gap-2 items-center z-50">
      <a className="cursor-pointer" href={mintUrl} target="_blank" rel="noopener noreferrer">
        <Button
          className="!h-8 !w-40 normal-case font-normal flex items-center rounded-md !text-md !px-3 !text-black shadow-[0px_4px_4px_0px_#00000040] border border-[0.5px] !border-[#F5C2971F] backdrop-blur-xs bg-white/5 hover:scale-105 hover:-translate-y-1 hover:!bg-gold/20 !text-gold "
          variant="default"
        >
          <TreasureChest className="!w-5 !h-5 mr-1 md:mr-2 fill-gold text-gold self-center" />
          Mint Season Pass
        </Button>
      </a>
      {controller && (
        <Controller
          className="!text-black !h-10 w-24 normal-case font-normal !bg-[#FCB843] hover:!bg-[#FCB843]/80"
          iconClassName="!fill-black"
        />
      )}
    </div>
  );
};

export const StepContainer = ({
  children,
  bottomChildren,
  tos = true,
  transition = true,
  loading = false,
}: StepContainerProps) => {
  const width = "max-w-[456px] w-full xl:w-[33vw]";
  const height = "max-h-[316px] h-[44vh] lg:h-[36vh] 2xl:h-[33vh]";
  const size = `${width} ${height}`;

  const [displayTermsOfService, setDisplayTermsOfService] = useState(false);

  const motionProps = transition
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, y: 20 },
        exit: { opacity: 0 },
        transition: { type: "ease-in-out", stiffness: 3, duration: 0.2 },
      }
    : {};

  return (
    <motion.div className="flex justify-center z-50 px-4 md:px-0 flex-col" {...motionProps}>
      <div
        className={`bg-black/20 self-center border-[0.5px] border-gradient rounded-lg p-6 lg:p-10 xl:p-8 2xl:p-12 text-gold w-full overflow-hidden relative z-50 backdrop-filter backdrop-blur-[24px] ${size} shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]`}
      >
        {displayTermsOfService ? (
          <div className="flex flex-col h-full max-h-full pb-4">
            <Button
              className="!h-12 !w-24 !bg-gold/10 !border-none hover:scale-105 hover:-translate-y-1 !px-3 !shadow-none hover:text-gold"
              variant="primary"
              onClick={() => setDisplayTermsOfService(false)}
            >
              <BackArrow className="w-6 h-6 mr-2 fill-current" />
              <div className="w-14 text-base font-normal normal-case inline">Back</div>
            </Button>
            <div className="w-full h-full pb-4 mt-2">
              <TermsOfService />
            </div>
          </div>
        ) : (
          <>
            <div className="w-full text-center">
              <div className="mx-auto flex mb-4 sm:mb-4 lg:mb-8 xl:mb-8 2xl:mb-10">
                {loading ? (
                  <img src="/images/eternumloader.png" className="w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2 mx-auto my-8" />
                ) : (
                  <EternumWordsLogo className="fill-current w-32 sm:w-40 lg:w-64 xl:w-64 stroke-current mx-auto" />
                )}
              </div>
            </div>
            {children}
          </>
        )}
      </div>

      {tos && (
        <div className="mt-4">
          <div className={`relative ${width}`}>
            <div className="w-full flex justify-center">
              <Lock className="w-4 h-4 fill-current relative bottom-0.45 mr-3" />
              <p className="text-xs text-center align-bottom my-auto" onClick={() => setDisplayTermsOfService(true)}>
                By continuing you are agreeing to Eternum's <span className="inline underline">Terms of Service</span>
              </p>
            </div>
            {bottomChildren}
            <div className="w-full text-center mt-4">
              <a
                href="https://eternum-docs.realms.world/overview/entry#season-access"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gold/80 hover:text-gold underline"
              >
                Learn more about Season Access
              </a>
            </div>
          </div>
        </div>
      )}
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
    <div className="absolute z-10 w-screen h-screen flex justify-center flex-wrap self-center">
      <OnboardingOverlay controller={controller} />
      <SeasonStartTimer />
      {children}
    </div>
  </div>
);

export const Onboarding = ({ backgroundImage }: OnboardingProps) => {
  const [settleRealm, setSettleRealm] = useState(false);
  const bottomChildren = useMemo(() => <SeasonPassButton setSettleRealm={setSettleRealm} />, [setSettleRealm]);

  return (
    <>
      {settleRealm ? (
        <OnboardingContainer backgroundImage={backgroundImage}>
          <SettleRealm onPrevious={() => setSettleRealm(false)} />
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
    setup: {
      systemCalls: { create_multiple_realms_dev },
    },
  } = useDojo();
  const [seasonPassRealms, setSeasonPassRealms] = useState<SeasonPassRealm[]>([]);
  const realms = usePlayerRealms();

  const createRandomRealm = () => {
    const newRealmId = Math.max(...realms.map((realm) => realm.realmId), 0) + 1;
    create_multiple_realms_dev({ signer: account, realm_ids: [newRealmId] });
  };

  useEffect(() => {
    const fetchSeasonPasses = async () => {
      const unsettledSeasonPassRealms = await getUnusedSeasonPasses(account.address, realms);
      setSeasonPassRealms(unsettledSeasonPassRealms);
    };
    fetchSeasonPasses();
  }, [realms, account.address]);

  const handleClick = seasonPassRealms.length > 0 ? () => setSettleRealm((prev) => !prev) : undefined;

  return seasonPassRealms.length > 0 ? (
    <Button
      onClick={env.VITE_PUBLIC_DEV ? createRandomRealm : handleClick}
      className={`mt-8 w-full h-8 md:h-12 lg:h-10 2xl:h-12 !text-black !bg-gold !normal-case rounded-md hover:scale-105 hover:-translate-y-1 ${
        realms.length === 0 ? "animate-pulse" : ""
      }`}
    >
      {env.VITE_PUBLIC_DEV ? (
        "Create Random Realm"
      ) : (
        <div className="flex items-center">
          <div className="w-6 h-6 bg-black/20 rounded-xl mr-1 md:mr-2 flex justify-center align-bottom text-center items-center">
            {seasonPassRealms.length}
          </div>
          Redeem Season Pass
        </div>
      )}
    </Button>
  ) : (
    <a
      className="text-black cursor-pointer text-lg"
      href={`https://market.realms.world/collection/${SEASON_PASS_MARKET_URL}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Button
        onClick={env.VITE_PUBLIC_DEV ? createRandomRealm : handleClick}
        className={`mt-8 w-full h-8 md:h-12 lg:h-10 2xl:h-12 !text-black !bg-gold !normal-case rounded-md hover:scale-105 hover:-translate-y-1 ${
          realms.length === 0 ? "animate-pulse" : ""
        }`}
      >
        <div className="flex items-center">
          <TreasureChest className="!w-5 !h-5 mr-1 md:mr-2 fill-black text-black" />
          Get Season Pass
        </div>
      </Button>
    </a>
  );
};

const SeasonStartTimer = () => {
  const nextBlockTimestamp = BigInt(useUIStore.getState().nextBlockTimestamp || 0);
  const seasonStart = BigInt(configManager.getSeasonConfig().startAt || 0);

  const [countdown, setCountdown] = useState<bigint>(0n);
  useEffect(() => {
    if (nextBlockTimestamp === 0n || seasonStart === 0n) return;

    const initialCountdown = seasonStart - nextBlockTimestamp;
    setCountdown(initialCountdown);

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1n);
    }, 1000);

    return () => clearInterval(timer);
  }, [nextBlockTimestamp, seasonStart]);

  if (countdown <= 0n) {
    return null;
  }

  return (
    <div className="fixed top-40 left-1/2 -translate-x-1/2 z-50">
      <div className="text-2xl bg-black/20 border-[0.5px] border-gradient rounded-lg px-6 py-3 text-gold backdrop-filter backdrop-blur-[24px] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] flex gap-2">
        <p className="font-semibold">{formatTime(Number(countdown), undefined, false, true)}</p>
      </div>
    </div>
  );
};
