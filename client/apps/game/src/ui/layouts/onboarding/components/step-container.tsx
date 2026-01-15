import { ReactNode } from "react";

import { ReactComponent as BackArrow } from "@/assets/icons/back.svg";
import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Button } from "@/ui/design-system/atoms";

import { motion } from "framer-motion";

import { env } from "../../../../../env";
import { TermsOfService } from "../../terms-of-service";

export interface StepContainerProps {
  children: ReactNode;
  bottomChildren?: ReactNode;
  tos?: boolean;
  transition?: boolean;
  loading?: boolean;
  isSettleRealm?: boolean;
  showLogo?: boolean;
}

export const StepContainer = ({
  children,
  bottomChildren,
  tos = true,
  transition = true,
  loading = false,
  isSettleRealm = false,
  showLogo = true,
}: StepContainerProps) => {
  const width = "w-[456px]";
  const showToS = useUIStore((state) => state.showToS);
  const setShowToS = useUIStore((state) => state.setShowToS);
  const isTermsEnabled = env.VITE_PUBLIC_ENABLE_TOS;
  const expandedWidth = (isTermsEnabled && showToS) || isSettleRealm ? "w-[800px]" : width;

  const motionProps = transition
    ? {
        initial: { opacity: 0, x: -20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0 },
        transition: { type: "ease-in-out", stiffness: 3, duration: 0.2 },
      }
    : {};

  const shouldRenderHeader = showLogo || loading;

  return (
    <motion.div className="flex h-screen w-full z-50 justify-end" {...motionProps}>
      <div
        className={`bg-black/20 border-r border-[0.5px] border-gradient p-3 text-gold relative z-50 backdrop-filter backdrop-blur-[32px] my-8 mr-8 panel-wood panel-wood-corners ${
          expandedWidth
        }`}
      >
        {isTermsEnabled && showToS ? (
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
            {shouldRenderHeader && (
              <div className="w-full text-center flex-shrink-0">
                <div className="mx-auto flex mb-4 sm:mb-4 lg:mb-8">
                  {loading ? (
                    <img
                      src="/images/logos/eternum-loader.png"
                      className="w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2 mx-auto my-8"
                    />
                  ) : (
                    showLogo && <EternumWordsLogo className="fill-brown w-56 sm:w-48 lg:w-72 xl:w-96 mx-auto" />
                  )}
                </div>
              </div>
            )}
            <div className="flex-grow overflow-auto">{children}</div>
            {tos && (
              <div className="mt-auto pt-4 flex-shrink-0">
                <div className="relative w-full">{!isSettleRealm && bottomChildren}</div>
                {isTermsEnabled && (
                  <div className="w-full flex justify-center rounded-lg pt-2">
                    <p className="text-xxs align-bottom my-auto ml-2 text-center">
                      By continuing you are agreeing <br /> to Realms'
                      <button type="button" className="ml-1 underline" onClick={() => setShowToS(true)}>
                        Terms of Service
                      </button>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
