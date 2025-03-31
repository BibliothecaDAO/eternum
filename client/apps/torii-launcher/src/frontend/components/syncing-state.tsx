import React, { useEffect, useState } from "react";
import { ProgressUpdatePayload } from "../../types";
import { useAppContext } from "../context";

export const SyncingState = React.memo(() => {
  const { reset } = useAppContext();

  const [gameSynced, setGameSynced] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const removeListener = window.electronAPI.onProgressUpdate((payload: ProgressUpdatePayload) => {
      setProgress(payload.progress);
      setGameSynced(payload.progress >= 1);
    });

    return () => {
      removeListener();
    };
  }, []);

  useEffect(() => {
    if (reset) {
      setGameSynced(false);
      setProgress(0);
    }
  }, [reset]);

  return gameSynced ? (
    <div className="text-gold text-center text-xs noselect">
      Game is fully synced, <br />
      do not close this window
    </div>
  ) : (
    <div className="flex flex-col items-center noselect">
      <div className="text-gold text-center text-xs mb-4">
        Game is syncing, <br />
        do not close this window
      </div>
      <div className="w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold/50 to-gold transition-all duration-300 ease-out"
          style={{ width: `${Math.min(Math.max(progress * 100, 0), 100)}%` }}
        ></div>
      </div>
    </div>
  );
});
