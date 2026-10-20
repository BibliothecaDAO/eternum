import { createContext, useContext } from "react";
import { useLocation } from "react-router-dom";

/**
 * A page's own address where it is drawn under another's: the app lab draws each real page under
 * /lab/app/<screen>, and gives the page's address here so the places light the page's own, as the app does.
 */
export const PageAddress = createContext<string | null>(null);

/** The address the places read as the page's own: the lab's, else the browser's. */
export const usePageAddress = (): string => {
  const { pathname } = useLocation();
  return useContext(PageAddress) ?? pathname;
};
