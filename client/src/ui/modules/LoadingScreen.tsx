import { useSeasonStart } from "@/hooks/useSeasonStart";
import { useEffect, useState } from "react";
import "../../index.css";
import { OnboardingContainer, StepContainer } from "../layouts/Onboarding";

export const LoadingScreen = ({ backgroundImage }: { backgroundImage: string }) => {
  const statements = [
    "Syncing Eternum...",
    "Gathering Dragonhide...",
    "Stepping the world...",
    "Painting the Sky...",
    "Crafting Stories...",
    "Harvesting Wood...",
    "Cooking Donkeys...",
    "Preparing Surprises...",
    "Forging Adamantine...",
    "Summoning Paladins...",
    "Enchanting Hartwood...",
    "Mining Deep Crystal...",
    "Cultivating Wheat Fields...",
    "Smelting Cold Iron...",
    "Training Crossbowmen...",
    "Extracting Ethereal Silica...",
    "Polishing Twilight Quartz...",
    "Awakening Ancient Spirits...",
  ];

  const [currentStatement, setCurrentStatement] = useState(0);

  useEffect(() => {
    const timestamp = Math.floor(Date.now() / (1000 * 60));

    const statementIndex = timestamp % statements.length;
    setCurrentStatement(statementIndex);

    const statementInterval = setInterval(() => {
      const newTimestamp = Math.floor(Date.now() / (1000 * 60));
      setCurrentStatement(newTimestamp % statements.length);
    }, 60000); // Check every minute

    return () => {
      clearInterval(statementInterval);
    };
  }, []);

  return (
    <OnboardingContainer backgroundImage={backgroundImage} controller={false}>
      <StepContainer tos={false} transition={false} loading={true}>
        <div className="mt-10 relative bottom-1 text-center text-xl">{`${statements[currentStatement]}`}</div>
        <div className="relative bottom-1 text-center text-xl">{`We are experiencing high loading times. Please be patient.`}</div>
      </StepContainer>
    </OnboardingContainer>
  );
};

export function CountdownTimer({ backgroundImage }: { backgroundImage: string }) {
  const { seasonStart, countdown, nextBlockTimestamp } = useSeasonStart();

  const days = Math.floor(Number(countdown) / (3600 * 24));
  const hours = Math.floor((Number(countdown) % (3600 * 24)) / 3600);
  const minutes = Math.floor((Number(countdown) % 3600) / 60);
  const seconds = Number(countdown) % 60;

  if (countdown < 0 || nextBlockTimestamp === 0n || seasonStart === 0n) return null;

  return (
    <div className="relative min-h-screen w-full pointer-events-auto">
      <img
        className="absolute h-screen w-screen object-cover"
        src={`/images/covers/${backgroundImage}.png`}
        alt="Cover"
      />
      <div className="absolute z-10 w-screen h-screen flex justify-center flex-wrap self-center">
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-xl" />
          <div className="relative flex flex-col items-center">
            <img src="/images/eternumloader.png" className="w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2 mx-auto my-8" />
            <h1 className="tracking-wider">Eternum is Launching in</h1>
            <div className="flex gap-4 text-center mt-4 mx-auto">
              <TimeUnit value={days} label="Days" />
              <TimeUnit value={hours} label="Hours" />
              <TimeUnit value={minutes} label="Minutes" />
              <TimeUnit value={seconds} label="Seconds" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimeUnitProps {
  value: number;
  label: string;
}

function TimeUnit({ value, label }: TimeUnitProps) {
  return (
    <div className="flex flex-col">
      <span className="text-4xl font-bold">{value.toString().padStart(2, "0")}</span>
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}
