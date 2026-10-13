import { Suspense, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { SCENE_ADDRESS_EVENT } from "./scene-address";

/** Set on <html> while a full-screen scene is mounted; index.css stops page scroll and panning only under it. */
export const SCENE_VIEWPORT_CLASS = "scene-viewport";

/**
 * A full-screen scene (a game, the labs) owns the viewport: the page must not scroll or pan under the canvas. It
 * claims that on mount and gives it back on unmount, so a shell page opened after leaving a game scrolls again. It
 * also announces every address it shows and its leaving, so the game's renderer, which outlives its route for a fast
 * return, takes its canvas off the app's pages and stops drawing until the player is back in a match.
 */
export const SceneRoute = ({ children, fallback }: { children: ReactNode; fallback: ReactNode }) => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(SCENE_VIEWPORT_CLASS);
    return () => root.classList.remove(SCENE_VIEWPORT_CLASS);
  }, []);
  useAnnounceSceneAddress();
  return <Suspense fallback={fallback}>{children}</Suspense>;
};

/** Announces the address on arrival, on each change of it, and again once the scene's frame has left it. */
const useAnnounceSceneAddress = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const announce = () => {
      window.dispatchEvent(new Event(SCENE_ADDRESS_EVENT));
    };
    announce();
    return announce;
  }, [pathname]);
};
