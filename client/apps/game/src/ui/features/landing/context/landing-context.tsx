import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface LandingContextValue {
  /** Current background ID */
  backgroundId: string;
  /** Set the background ID (for game selection changes) */
  setBackgroundId: (id: string) => void;
  /** Reset to default route-based background */
  resetBackground: () => void;
}

const LandingContext = createContext<LandingContextValue | null>(null);

interface LandingProviderProps {
  children: ReactNode;
  defaultBackground?: string;
}

export const LandingProvider = ({ children, defaultBackground = "01" }: LandingProviderProps) => {
  const [backgroundId, setBackgroundIdState] = useState(defaultBackground);

  const setBackgroundId = useCallback((id: string) => {
    setBackgroundIdState(id);
  }, []);

  const resetBackground = useCallback(() => {
    setBackgroundIdState(defaultBackground);
  }, [defaultBackground]);

  return (
    <LandingContext.Provider value={{ backgroundId, setBackgroundId, resetBackground }}>
      {children}
    </LandingContext.Provider>
  );
};

export const useLandingContext = (): LandingContextValue => {
  const context = useContext(LandingContext);
  if (!context) {
    throw new Error("useLandingContext must be used within a LandingProvider");
  }
  return context;
};

/**
 * Hook to get just the background change function (for child components)
 */
export const useBackgroundChange = () => {
  const { setBackgroundId } = useLandingContext();
  return setBackgroundId;
};
