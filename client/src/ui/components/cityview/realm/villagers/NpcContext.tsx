import { createContext, useContext, ReactNode, useState } from "react";

type NpcContextProps = {
  selectedTownhall: number | null;
  setSelectedTownhall: (newIndex: number | null) => void;
  lastMessageDisplayedIndex: number;
  setLastMessageDisplayedIndex: (newIndex: number) => void;
  loadingTownhall: boolean;
  setLoadingTownhall: (newValue: boolean) => void;
};

type Props = {
  children: ReactNode;
};

const NpcContext = createContext<NpcContextProps | null>(null);

export const NpcProvider = ({ children }: Props) => {
  const currentContext = useContext(NpcContext);
  if (currentContext) throw new Error("NpcProvider can only be used once");
  const [selectedTownhall, setSelectedTownhall] = useState<number | null>(null);
  const [lastMessageDisplayedIndex, setLastMessageDisplayedIndex] = useState(0);
  const [loadingTownhall, setLoadingTownhall] = useState<boolean>(false);

  const contextValue: NpcContextProps = {
    selectedTownhall,
    setSelectedTownhall,
    lastMessageDisplayedIndex,
    setLastMessageDisplayedIndex,
    loadingTownhall,
    setLoadingTownhall,
  };
  return <NpcContext.Provider value={contextValue}>{children}</NpcContext.Provider>;
};

export const useNpcContext = () => {
  const context = useContext(NpcContext);
  if (!context) throw new Error("Must be used within a NpcProvider");
  return context;
};
