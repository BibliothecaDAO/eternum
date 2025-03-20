import { createContext, ReactNode, useContext, useState } from "react";
import { ConfigType, ToriiConfig } from "../types";
import { WarningType } from "./types";

interface AppContextType {
  currentConfig: ToriiConfig | null;
  setCurrentConfig: (config: ToriiConfig) => void;
  reset: boolean;
  setReset: (reset: boolean) => void;
  showWarning: WarningType | null;
  setShowWarning: (warning: WarningType | null) => void;
  showSettings: boolean;
  setShowSettings: (showSettings: boolean) => void;
  newConfig: ConfigType | null;
  setNewConfig: (config: ConfigType) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentConfig, setCurrentConfig] = useState<ToriiConfig | null>(null);
  const [reset, setReset] = useState(false);
  const [showWarning, setShowWarning] = useState<WarningType | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newConfig, setNewConfig] = useState<ConfigType | null>(null);

  const value = {
    currentConfig,
    setCurrentConfig,
    reset,
    setReset,
    showWarning,
    setShowWarning,
    showSettings,
    setShowSettings,
    newConfig,
    setNewConfig,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
