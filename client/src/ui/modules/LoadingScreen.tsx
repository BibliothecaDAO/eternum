import { useEffect, useState } from "react";
import "../../index.css";

export const LoadingScreen = () => {
  const statements = [
    "Syncing Eternum...",
    "Gathering Dragonhide...",
    "Stepping the world...",
    "Painting the Sky...",
    "Crafting Stories...",
    "Harvesting Wood...",
    "Breading Donkeys...",
    "Preparing Surprises...",
    "Ready to Explore!",
  ];

  const [currentStatement, setCurrentStatement] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentStatement((prev) => (prev + 1) % statements.length);
        setFade(true);
      }, 500); // Half second for fade-out effect
    }, 3000); // Change statement every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-screen w-screen bg-black">
      <img className="absolute h-screen w-screen object-cover" src="/images/cover.png" alt="" />
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 animatedBackground -translate-y-1/2 text-2xl text-center bg-black/90 p-10 border border-gradient bg-hex-bg rounded-sm min-w-96  ${
          fade ? "fade-in" : "fade-out"
        }`}
      >
        {statements[currentStatement]}
      </div>
    </div>
  );
};
