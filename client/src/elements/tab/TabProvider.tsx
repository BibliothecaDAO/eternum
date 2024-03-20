import type { ReactNode } from "react";
import { createContext } from "react";
import type { VARIANTS } from "./tabs";

interface TabContextType {
  variant: keyof typeof VARIANTS;
}

export const TabContext = createContext<TabContextType | null>(null);

interface Props extends TabContextType {
  children: ReactNode;
}

export const TabProvider = ({ children, variant }: Props) => {
  return <TabContext.Provider value={{ variant }}>{children}</TabContext.Provider>;
};
