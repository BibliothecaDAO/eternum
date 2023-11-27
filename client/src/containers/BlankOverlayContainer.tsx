import { Transition } from "@headlessui/react";
import React, { Fragment } from "react";
import useUIStore from "../hooks/store/useUIStore";

type BlurOverlayContainerProps = {
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const BlankOverlayContainer = ({ children }: BlurOverlayContainerProps) => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  return (
    <Transition
      show={showBlankOverlay}
      as={Fragment}
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className="top-0 left-0 flex justify-center items-center rounded-lg z-50 fixed bg-black">{children}</div>
    </Transition>
  );
};
