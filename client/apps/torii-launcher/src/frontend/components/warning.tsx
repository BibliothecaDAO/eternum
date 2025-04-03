import { useEffect, useState } from "react";
import { useAppContext } from "../context";
import { ButtonLike } from "./button-like";

export const Warning = () => {
  const { showWarning, setShowWarning } = useAppContext();

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
    showWarning && (
      <div
        className={`fixed inset-0 bg-white/30 backdrop-blur-md flex flex-col items-center justify-center z-50 select-none
        transition-opacity duration-300 ease-in-out gap-6
        ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={handleClose}
      >
        <div className="flex flex-col w-fit h-fit gap-1">
          <p className="text-base font-bold text-center uppercase">Are you sure you want to {showWarning?.name}?</p>
          <p className="text-sm text-center w-full">{showWarning?.alertMessage}</p>
        </div>
        <div className="flex flex-row gap-3 w-fit h-fit">
          <ButtonLike
            className="!h-8 transition-all duration-300 ease-in-out hover:!scale-102 !text-sm px-4 py-1 bg-[#000000]/50  hover:bg-[#ffffff]/10"
            onClick={handleClose}
          >
            Cancel
          </ButtonLike>
          <ButtonLike
            className="!h-8 !bg-red hover:!bg-red/70 text-white transition-all duration-300 ease-in-out hover:!scale-102 !text-sm px-4 py-1"
            onClick={() => {
              showWarning?.callback();
              handleClose();
            }}
          >
            Confirm
          </ButtonLike>
        </div>
      </div>
    )
  );
};
