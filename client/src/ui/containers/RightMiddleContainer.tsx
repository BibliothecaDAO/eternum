import { createContext, useState } from "react";

interface RightModuleContextType {
  isOffscreen: boolean;
  setIsOffscreen: (val: boolean) => void;
}

export const RightModuleContext = createContext<RightModuleContextType | null>(null);

export const RightMiddleContainer = ({ children }: { children: React.ReactNode }) => {
  const [isOffscreen, setIsOffscreen] = useState(false);

  return (
    <div
      className={`pointer-events-none absolute transition-all  z-20 w-auto top-24 right-0 ${
        isOffscreen ? "translate-x-[83%]" : ""
      }`}
    >
      <RightModuleContext.Provider value={{ isOffscreen, setIsOffscreen }}>{children}</RightModuleContext.Provider>
    </div>
  );
};

export default RightMiddleContainer;
