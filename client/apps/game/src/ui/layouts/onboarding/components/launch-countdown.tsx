import { useMemo } from "react";

import { useSeasonStart } from "@bibliothecadao/react";

import { OnboardingContainer } from "./onboarding-container";

interface OnboardingCountdownOverlayProps {
  backgroundImage: string;
}

interface TimeBreakdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Converts the raw countdown (in seconds) into user-friendly time segments.
 */
const toTimeBreakdown = (totalSeconds: number): TimeBreakdown => {
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return { days, hours, minutes, seconds };
};

const formatTimeSegment = (value: number) => value.toString().padStart(2, "0");

export const OnboardingCountdownOverlay = ({ backgroundImage }: OnboardingCountdownOverlayProps) => {
  const { seasonStart, countdown, currentBlockTimestamp } = useSeasonStart();

  const resolvedCountdown = Number(countdown);
  const timeBreakdown = useMemo(() => toTimeBreakdown(resolvedCountdown), [resolvedCountdown]);

  if (resolvedCountdown < 0 || currentBlockTimestamp === 0n || seasonStart === 0n) {
    return null;
  }

  return (
    <OnboardingContainer backgroundImage={backgroundImage}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-xl" />
      <div className="relative z-10 flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center">
          <img src="/images/logos/eternum-loader.png" className="mx-auto my-8 w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2" />
          <h1 className="tracking-wider">Realms is Launching in</h1>
          <div className="mt-4 flex gap-4 text-center">
            <TimeUnit value={timeBreakdown.days} label="Days" />
            <TimeUnit value={timeBreakdown.hours} label="Hours" />
            <TimeUnit value={timeBreakdown.minutes} label="Minutes" />
            <TimeUnit value={timeBreakdown.seconds} label="Seconds" />
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
};

interface TimeUnitProps {
  value: number;
  label: string;
}

const TimeUnit = ({ value, label }: TimeUnitProps) => (
  <div className="flex flex-col">
    <span className="text-4xl font-bold">{formatTimeSegment(value)}</span>
    <span className="text-sm">{label}</span>
  </div>
);
