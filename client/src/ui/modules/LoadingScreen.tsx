import { useEffect, useState } from "react";
import "../../index.css";
import { OnboardingContainer, StepContainer } from "../layouts/Onboarding";

export const LoadingScreen = ({ backgroundImage }: { backgroundImage: string }) => {
  const statements = [
    "Syncing Eternum",
    "Gathering Dragonhide",
    "Stepping the world",
    "Painting the Sky",
    "Crafting Stories",
    "Harvesting Wood",
    "Cooking Donkeys",
    "Preparing Surprises",
    "Forging Adamantine",
    "Summoning Paladins",
    "Enchanting Hartwood",
    "Mining Deep Crystal",
    "Cultivating Wheat Fields",
    "Smelting Cold Iron",
    "Training Crossbowmen",
    "Extracting Ethereal Silica",
    "Polishing Twilight Quartz",
    "Awakening Ancient Spirits",
  ];

  const [currentStatement, setCurrentStatement] = useState(0);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    // Get current timestamp in minutes
    const timestamp = Math.floor(Date.now() / (1000 * 60));

    // Get statement index based on current minute
    const statementIndex = timestamp % statements.length;
    setCurrentStatement(statementIndex);

    // Dot animation interval
    const dotInterval = setInterval(() => {
      setDots((prevDots) => (prevDots + 1) % 4);
    }, 1000);

    // Statement update interval
    const statementInterval = setInterval(() => {
      const newTimestamp = Math.floor(Date.now() / (1000 * 60));
      setCurrentStatement(newTimestamp % statements.length);
    }, 60000); // Check every minute

    return () => {
      clearInterval(dotInterval);
      clearInterval(statementInterval);
    };
  }, []);

  const renderStatementWithDots = () => {
    const dotString = dots > 0 ? ".".repeat(dots) : "";
    return `${statements[currentStatement]}${dotString}`;
  };

  return (
    <OnboardingContainer backgroundImage={backgroundImage} controller={false}>
      <StepContainer tos={false} transition={false}>
        <div className="p-4 text-center">{renderStatementWithDots()}</div>
      </StepContainer>
    </OnboardingContainer>
  );
};
