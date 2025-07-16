import { useSyncStore } from "@/hooks/store/use-sync-store";
import { OnboardingContainer } from "@/ui/layouts/onboarding";
import { useSeasonStart } from "@bibliothecadao/react";
import { useEffect, useState } from "react";
import "../../index.css";
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
  // sync progress out of 100
  const initialSyncProgress = useSyncStore((state) => state.initialSyncProgress);

  useEffect(() => {
    // Set initial statement
    setCurrentStatement(Math.floor(Math.random() * statements.length));

    // Cycle through statements every 3 seconds
    const statementInterval = setInterval(() => {
      setCurrentStatement((prevStatement) => (prevStatement + 1) % statements.length);
    }, 3000);

    return () => {
      clearInterval(statementInterval);
    };
  }, [statements.length]);

  return (
    <OnboardingContainer backgroundImage={backgroundImage} controller={false}>
      <div className="h-screen w-screen flex justify-center align-middle">
        <div className="mt-10 w-[500px] relative bottom-1 text-center text-xl self-center panel-wood bg-dark-wood panel-wood-corners p-4 px-12">
          {" "}
          <img src="/images/logos/eternum-loader.png" className="w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2 mx-auto my-8" />
          {`${statements[currentStatement]}`}
          <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
            <div
              className="bg-gold h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${initialSyncProgress}%` }}
            />
          </div>
          <div className="text-sm mt-2 text-gray-300">{initialSyncProgress === 100 ? 99 : initialSyncProgress}%</div>
        </div>
      </div>
    </OnboardingContainer>
  );
};

export function CountdownTimer({ backgroundImage }: { backgroundImage: string }) {
  const { seasonStart, countdown, currentBlockTimestamp } = useSeasonStart();

  const days = Math.floor(Number(countdown) / (3600 * 24));
  const hours = Math.floor((Number(countdown) % (3600 * 24)) / 3600);
  const minutes = Math.floor((Number(countdown) % 3600) / 60);
  const seconds = Number(countdown) % 60;

  if (countdown < 0 || currentBlockTimestamp === 0n || seasonStart === 0n) return null;

  return (
    <div className="relative min-h-screen w-full pointer-events-auto">
      <img
        className="absolute h-screen w-screen object-cover"
        src={`/images/covers/blitz/${backgroundImage}.png`}
        alt="Cover"
      />
      <div className="absolute z-10 w-screen h-screen flex justify-center flex-wrap self-center">
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-xl" />
          <div className="relative flex flex-col items-center">
            <img
              src="/images/logos/eternum-loader.png"
              className="w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2 mx-auto my-8"
            />
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
