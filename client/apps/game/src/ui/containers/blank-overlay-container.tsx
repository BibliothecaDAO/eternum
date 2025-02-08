import { Transition } from "@headlessui/react";
import { Fragment, memo } from "react";

type BlurOverlayContainerProps = {
  children?: React.ReactNode;
  open: boolean;
  zIndex?: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const BlankOverlayContainer = memo(({ children, open, zIndex = 10001 }: BlurOverlayContainerProps) => {
  return (
    <Transition
      show={open}
      as={Fragment}
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div
        className={`top-0 left-0 flex justify-center items-center rounded-lg fixed w-screen h-screen pointer-events-auto`}
        style={{ zIndex }}
      >
        {children}
      </div>
    </Transition>
  );
});
