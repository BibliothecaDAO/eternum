import React, { useState, useEffect } from "react";
import "../../index.css";

export const LoadingScreen = () => {
  const statements = [
    "Loading Worlds...",
    "Gathering Resources...",
    "Assembling Characters...",
    "Painting the Sky...",
    "Crafting Stories...",
    "Setting Up Adventures...",
    "Finalizing Details...",
    "Almost There...",
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
      <img className="absolute h-screen w-screen object-cover" src="/images/cover-3.jpeg" alt="" />
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl text-center bg-brown p-10 text-gold border-y-2 border-gradient ${
          fade ? "fade-in" : "fade-out"
        }`}
      >
        {statements[currentStatement]}
      </div>
    </div>
  );
};
