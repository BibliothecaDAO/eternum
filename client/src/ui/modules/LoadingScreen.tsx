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
      </StepContainer>
    </OnboardingContainer>
  );
};
