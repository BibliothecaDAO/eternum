import EternumLogo from "@public/eternum-new.svg?react";
import Refresh from "@public/refresh.svg?react";
import TrashCan from "@public/trashcan.svg?react";
import { useEffect, useState } from "react";
import styled from "styled-components";
import { IpcMethod } from "../types";
import Button from "./button";
import { SyncingState } from "./syncing-state";

export const App = () => {
  const [reset, setReset] = useState(false);
  const [showWarning, setShowWarning] = useState<{
    method: IpcMethod;
    alertMessage: string;
  } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (showWarning) {
      // Trigger reflow to ensure transition works
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
    }
  }, [showWarning]);

  const handleClose = () => {
    setIsVisible(false);
    // Wait for transition to complete before removing the warning
    setTimeout(() => {
      setShowWarning(null);
    }, 300); // match the duration of your CSS transition
  };

  const DraggableArea = styled.div`
    -webkit-app-region: drag;
    width: 100vw;
    min-height: 30px;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
  `;
  return (
    <>
      <DraggableArea />
      {showWarning && (
        <div
          className={`fixed top-0 left-0 right-0 bottom-0 w-full h-full flex flex-col justify-center items-center bg-black/90 
          transition-opacity duration-300 ease-in-out 
          ${isVisible ? "opacity-100" : "opacity-0"}`}
        >
          <div
            className={`flex flex-col justify-center items-center w-[60vw] 
          transition-all duration-300 ease-in-out 
          ${isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
          >
            <p className="text-xs rounded-md text-white p-4 text-center w-full">{showWarning.alertMessage}</p>
            <div className="flex flex-row gap-4 mt-2">
              <Button
                className="hover:bg-brown/90 hover:text-gold/90"
                size="sm"
                variant="default"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                className="hover:bg-red/90 hover:text-white"
                variant="default"
                size="sm"
                onClick={() => {
                  window.electronAPI.sendMessage(showWarning.method);
                  if (showWarning.method === IpcMethod.ResetDatabase) {
                    console.log("setting reset to true");
                    setReset(true);
                  }
                  handleClose();
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="text-white h-full flex flex-col justify-center items-center">
        <EternumLogo className="w-20 h-20 fill-gold mb-4" />
        <SyncingState reset={reset} />
      </div>
      <div className="flex flex-row items-center mb-4 gap-4">
        <Refresh
          className="hover:bg-brown/10 w-4 h-4 fill-gold transition-all duration-300 ease-in-out hover:scale-125"
          onClick={() =>
            setShowWarning({
              method: IpcMethod.KillTorii,
              alertMessage: killToriiAlertMessage,
            })
          }
        />

        <TrashCan
          className="hover:bg-brown/10 w-4 h-4 fill-red transition-all duration-300 ease-in-out hover:scale-125"
          onClick={() =>
            setShowWarning({
              method: IpcMethod.ResetDatabase,
              alertMessage: resetDatabaseAlertMessage,
            })
          }
        />
      </div>
    </>
  );
};

const resetDatabaseAlertMessage =
  "Careful, this will reset the database and restart the syncing process from the beginning.";
const killToriiAlertMessage = "Careful, if you are in the process of syncing, this could cause issues with the data";
