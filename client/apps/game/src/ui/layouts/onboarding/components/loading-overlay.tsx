import { useEffect, useMemo, useState } from "react";

import { useSyncStore } from "@/hooks/store/use-sync-store";

import { OnboardingContainer } from "./onboarding-container";
import { DEFAULT_LOADING_STATEMENTS } from "../constants";

const STATEMENT_INTERVAL_MS = 3000;

interface OnboardingLoadingOverlayProps {
  backgroundImage: string;
  statements?: readonly string[];
  progress?: number;
}

/**
 * Normalizes raw progress values to stay within the 0-100 range the UI expects.
 */
const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/**
 * Cycles through loading statements to keep the overlay lively while players wait.
 */
const useCyclingStatement = (statements: readonly string[], intervalMs: number) => {
  const [index, setIndex] = useState(() => (statements.length ? Math.floor(Math.random() * statements.length) : 0));

  useEffect(() => {
    if (statements.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setIndex((prev) => ((prev + 1) % statements.length + statements.length) % statements.length);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [intervalMs, statements.length]);

  useEffect(() => {
    if (statements.length === 0) {
      setIndex(0);
    } else {
      setIndex((prev) => prev % statements.length);
    }
  }, [statements.length]);

  return statements.length ? statements[index] : "";
};

export const OnboardingLoadingOverlay = ({
  backgroundImage,
  statements = DEFAULT_LOADING_STATEMENTS,
  progress,
}: OnboardingLoadingOverlayProps) => {
  const storeProgress = useSyncStore((state) => state.initialSyncProgress);

  const resolvedProgress = useMemo(() => {
    const next = typeof progress === "number" ? progress : storeProgress;
    return clampProgress(next);
  }, [progress, storeProgress]);

  const currentStatement = useCyclingStatement(statements, STATEMENT_INTERVAL_MS);
  const displayProgress = resolvedProgress === 100 ? 99 : resolvedProgress;

  return (
    <OnboardingContainer backgroundImage={backgroundImage}>
      <div className="flex h-full w-full items-center justify-center">
        <div className="panel-wood panel-wood-corners bg-dark-wood relative bottom-1 mt-10 w-[500px] self-center px-12 py-4 text-center text-xl">
          <img src="/images/logos/eternum-loader.png" className="mx-auto my-8 w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2" />
          <div>{currentStatement}</div>
          <div className="mt-4 h-2.5 w-full rounded-full">
            <div
              className="h-2.5 rounded-full bg-gold transition-all duration-300"
              style={{ width: `${resolvedProgress}%` }}
            />
          </div>
          <div className="mt-2 text-sm">{displayProgress}%</div>
        </div>
      </div>
    </OnboardingContainer>
  );
};
