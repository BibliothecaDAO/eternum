import { useEffect, useState } from "react";
import { IpcMethod } from "../../types";
import Button from "../utils/button";

export const Warning = ({
  showWarning,
  setShowWarning,
  setReset,
}: {
  showWarning: {
    method: IpcMethod;
    alertMessage: string;
  } | null;
  setShowWarning: (
    showWarning: {
      method: IpcMethod;
      alertMessage: string;
    } | null,
  ) => void;
  setReset: (reset: boolean) => void;
}) => {
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

  return (
    <div
      className={`flex flex-col justify-start items-center max-h-full h-full
		transition-all duration-300 ease-in-out p-4
		${isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
    >
      <p className="text-xs rounded-md text-gold text-center w-full">{showWarning.alertMessage}</p>
      <div className="flex flex-row gap-4 mt-2">
        <Button
          className="mt-3 !h-6 !bg-gold hover:!bg-gold/70 text-brown transition-all duration-300 ease-in-out hover:!scale-102 !text-xs"
          onClick={handleClose}
        >
          Cancel
        </Button>
        <Button
          className="mt-3 !h-6 !bg-red hover:!bg-red/70 text-white transition-all duration-300 ease-in-out hover:!scale-102 !text-xs"
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
  );
};
