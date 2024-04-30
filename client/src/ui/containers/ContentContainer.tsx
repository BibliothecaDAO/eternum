import { Transition } from "@headlessui/react";
import useUIStore from "../../hooks/store/useUIStore";
import { Fragment } from "react";

const ContentContainer = ({ children }: { children: React.ReactNode }) => {
  const isSideMenuOpened = useUIStore((state) => state.isSideMenuOpened);

  return (
    <Transition
      show={isSideMenuOpened}
      as={Fragment}
      enter="transition-all duration-300"
      enterFrom="-ml-[470px]"
      enterTo="ml-0"
      leave="transition-all duration-300"
      leaveFrom="ml-0"
      leaveTo="-ml-[470px]"
      appear
    >
      <div className="absolute w-[420px] -ml left-6 bottom-10 h-[calc(100vh-14.5rem)] root-container">{children}</div>
    </Transition>
  );
};

export default ContentContainer;
