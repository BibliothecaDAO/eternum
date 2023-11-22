import { Transition } from "@headlessui/react";
import useUIStore from "../hooks/store/useUIStore";
import { Fragment } from "react";

const ContentContainer = ({ children }: { children: React.ReactNode }) => {
  const isSideMenuOpened = useUIStore((state) => state.isSideMenuOpened);

  return (
    <Transition
      show={isSideMenuOpened}
      as={Fragment}
      enter="transition-transform duration-300"
      enterFrom="-translate-x-[125%]"
      enterTo="translate-x-0"
      leave="transition-transfirn duration-300"
      leaveFrom="translate-x-0"
      leaveTo="-translate-x-[125%]"
      appear
    >
      <div className="absolute w-[420px] left-6 bottom-10 h-[calc(100vh-14.5rem)] root-container">{children}</div>
    </Transition>
  );
};

export default ContentContainer;
