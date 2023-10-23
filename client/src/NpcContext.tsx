import { createContext, ReactNode, useContext } from "react";

type NpcSetup = {
  genMsg: boolean;
  setGenMsg: any;
  type: string;
  setType: any;
};

const NpcContext = createContext<NpcSetup | null>(null);

type Props = {
  children: ReactNode;
  genMsg: boolean;
  setGenMsg: any;
  type: string;
  setType: any;
};

export const NpcProvider = ({ children, setGenMsg, genMsg, type, setType }: Props) => {
  const currentValue = useContext(NpcContext);
  if (currentValue) throw new Error("NpcProvider can only be used once");

  const contextValue: NpcSetup = {
    genMsg,
    setGenMsg,
    type,
    setType,
  };

  return <NpcContext.Provider value={contextValue}>{children}</NpcContext.Provider>;
};

export const useNpcs = () => {
  const value = useContext(NpcContext);
  if (!value) throw new Error("Must be used within a NpcProvider context");
  return value;
};
