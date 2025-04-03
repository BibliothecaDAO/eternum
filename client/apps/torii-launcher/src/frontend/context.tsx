import { createContext, ReactNode, useContext, useState } from "react";
import { ToriiConfig } from "../types";
import { WarningType } from "./types";

export enum Page {
  Start,
  Syncing,
}

interface AppContextType {
  currentConfig: ToriiConfig | null;
  setCurrentConfig: (config: ToriiConfig) => void;
  reset: boolean;
  setReset: (reset: boolean) => void;
  showWarning: WarningType | null;
  setShowWarning: (warning: WarningType | null) => void;
  showSettings: boolean;
  setShowSettings: (showSettings: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  page: Page;
  setPage: (page: Page) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentConfig, setCurrentConfig] = useState<ToriiConfig | null>(null);
  const [reset, setReset] = useState(false);
  const [showWarning, setShowWarning] = useState<WarningType | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState(Page.Start);

  const value = {
    currentConfig,
    setCurrentConfig,
    reset,
    setReset,
    showWarning,
    setShowWarning,
    showSettings,
    setShowSettings,
    progress,
    setProgress,
    page,
    setPage,
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
