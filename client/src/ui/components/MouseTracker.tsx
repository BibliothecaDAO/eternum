import useUIStore from "@/hooks/store/useUIStore";
import { useEffect } from "react";
import { throttle } from "lodash";

export const MouseTracker = () => {
  const setMouseCoords = useUIStore((state) => state.setMouseCoords);
  useEffect(() => {
    const mouseMoveHandler = throttle((e: MouseEvent) => {
      setMouseCoords({
        x: e.clientX,
        y: e.clientY,
      });
    }, 100); // Throttling the event handler to execute once every 100ms
    document.addEventListener("mousemove", mouseMoveHandler);
    return () => {
      document.removeEventListener("mousemove", mouseMoveHandler);
      mouseMoveHandler.cancel(); // Cancel any trailing invocation of the throttled function
    };
  }, []);
  return <></>;
};
