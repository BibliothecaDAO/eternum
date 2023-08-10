import { Transition } from "@headlessui/react";
import React, { Fragment } from "react";
import useUIStore from "../hooks/store/useUIStore";

type BlurOverlayContainerProps = {
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const BlurOverlayContainer = ({
  children,
}: BlurOverlayContainerProps) => {
  const showBlurOverlay = useUIStore((state) => state.showBlurOverlay);
  return (
    <Transition
      show={showBlurOverlay}
      as={Fragment}
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className="top-3 flex justify-center items-center rounded-lg left-3 right-3 bottom-3 z-50 fixed backdrop-blur-xl">
        {children}
      </div>
    </Transition>
  );
};
