import { motion, AnimatePresence } from "framer-motion";

import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import type { UnifiedOnboardingState } from "@/hooks/context/use-unified-onboarding";

import { AccountPanel } from "./account-panel";
import { BackgroundProgress } from "./background-progress";
import { LoadingPanel } from "./loading-panel";
import { SettlementPanel } from "./settlement-panel";
import { StepIndicator } from "./step-indicator";
import { WorldSelectPanel } from "./world-select-panel";

interface UnifiedOnboardingScreenProps {
  backgroundImage: string;
  state: UnifiedOnboardingState;
}

export const UnifiedOnboardingScreen = ({ backgroundImage, state }: UnifiedOnboardingScreenProps) => {
  const { phase, bootstrap, isConnecting, selectWorld, connectWallet, spectate, enterGame } = state;

  const isBootstrapRunning = bootstrap.status === "loading";
  const currentTaskLabel = bootstrap.tasks.find((t) => t.status === "running")?.label ?? null;

  // Don't show background progress on loading phase (it's shown inline)
  const showBackgroundProgress = phase !== "loading" && phase !== "ready";

  return (
    <div className="relative min-h-screen w-full pointer-events-auto">
      {/* Background Image */}
      <img
        className="absolute h-screen w-screen object-cover"
        src={`/images/covers/blitz/${backgroundImage}.png`}
        alt="Cover"
      />

      {/* Main Content */}
      <div className="absolute z-10 w-screen h-screen flex">
        {/* Left side - Logo */}
        <div className="pointer-events-none flex flex-1 items-center pl-16">
          <EternumWordsLogo className="fill-brown w-56 sm:w-48 lg:w-72 xl:w-[360px]" />
        </div>

        {/* Right side - Panel */}
        <div className="flex flex-1 justify-end">
          <motion.div
            className="flex h-screen w-full z-50 justify-end"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "ease-in-out", duration: 0.3 }}
          >
            <div className="bg-black/20 border-r border-[0.5px] border-gradient p-3 text-gold relative z-50 backdrop-filter backdrop-blur-[32px] my-8 mr-8 panel-wood panel-wood-corners w-[456px] flex flex-col">
              {/* Step Indicator */}
              <StepIndicator currentPhase={phase} isBootstrapRunning={isBootstrapRunning} />

              {/* Dynamic Content */}
              <div className="flex-1 overflow-hidden px-4 py-2">
                <AnimatePresence mode="wait">
                  {phase === "world-select" && (
                    <motion.div
                      key="world-select"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="h-full"
                    >
                      <WorldSelectPanel onSelect={selectWorld} />
                    </motion.div>
                  )}

                  {phase === "account" && (
                    <motion.div
                      key="account"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="h-full"
                    >
                      <AccountPanel
                        onConnect={connectWallet}
                        onSpectate={spectate}
                        isConnecting={isConnecting}
                        isBootstrapRunning={isBootstrapRunning}
                        bootstrapProgress={bootstrap.progress}
                      />
                    </motion.div>
                  )}

                  {phase === "loading" && (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="h-full"
                    >
                      <LoadingPanel
                        tasks={bootstrap.tasks}
                        progress={bootstrap.progress}
                        error={bootstrap.error}
                        onRetry={bootstrap.retry}
                      />
                    </motion.div>
                  )}

                  {phase === "settlement" && (
                    <motion.div
                      key="settlement"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="h-full"
                    >
                      <SettlementPanel onEnterGame={enterGame} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Background Progress Bar (subtle, at bottom) */}
              <BackgroundProgress
                progress={bootstrap.progress}
                isRunning={isBootstrapRunning}
                currentTask={currentTaskLabel}
                visible={showBackgroundProgress}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
