import { useEffect } from "react";
import { ProgressUpdatePayload } from "../../types";
import { useAppContext } from "../context";

export const useProgress = () => {
  const { setProgress } = useAppContext();

  useEffect(() => {
    const removeListener = window.electronAPI.onProgressUpdate((payload: ProgressUpdatePayload) => {
      if (!payload) return;
      setProgress(parseFloat(Math.min(Math.max(payload.progress * 100, 0), 100).toFixed(2)));
    });

    return () => {
      removeListener();
    };
  }, []);
};
