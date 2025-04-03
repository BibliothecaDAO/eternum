import TrashCan from "@public/icons/trashcan.svg?react";
import { IpcMethod } from "../../types";
import { useAppContext } from "../context";

export const DeleteButton = () => {
  const { setShowWarning, setReset } = useAppContext();
  return (
    <div
      onClick={() =>
        setShowWarning({
          alertMessage: resetDatabaseAlertMessage,
          callback: () => {
            window.electronAPI.sendMessage(IpcMethod.ResetDatabase);
            setReset(true);
          },
          name: "reset progress",
        })
      }
      className="flex flex-row gap-1 items-center justify-center select-none cursor-pointer"
    >
      <TrashCan className="w-4 h-4 text-red" /> <div className="text-white text-xs">Delete</div>
    </div>
  );
};

const resetDatabaseAlertMessage = "This will wipe progress on all chains and restart the syncing process.";
