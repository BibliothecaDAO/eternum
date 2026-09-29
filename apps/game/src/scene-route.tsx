import { Suspense, useEffect, type ReactNode } from "react";

/** Set on <html> while a full-screen scene is mounted; index.css stops page scroll and panning only under it. */
export const SCENE_VIEWPORT_CLASS = "scene-viewport";

/**
 * A full-screen scene (a game, the labs) owns the viewport: the page must not scroll or pan under the canvas. It
 * claims that on mount and gives it back on unmount, so a shell page opened after leaving a game scrolls again.
 */
export const SceneRoute = ({ children, fallback }: { children: ReactNode; fallback: ReactNode }) => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(SCENE_VIEWPORT_CLASS);
    return () => root.classList.remove(SCENE_VIEWPORT_CLASS);
  }, []);
  return <Suspense fallback={fallback}>{children}</Suspense>;
};
