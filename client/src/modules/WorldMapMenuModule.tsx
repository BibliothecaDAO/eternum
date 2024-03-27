import WorldMapMenuComponent from "../components/worldmap/WorldMapMenu";
import { ExploreNotifications } from "../components/worldmap/ExploreNotification";
import { BaseContainer } from "../containers/BaseContainer";
import { Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import { useLocation } from "wouter";

const WorldMapMenuModule = () => {
  const [location] = useLocation();
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (location.includes("/map")) {
      setShowMenu(true);
    } else {
      setShowMenu(false);
    }
  }, [location]);

  return (
    <>
      {
        <Transition
          show={showMenu}
          appear
          as={Fragment}
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <BaseContainer className="max-h-full h-min !p-0 mt-2">
            <WorldMapMenuComponent />
          </BaseContainer>
        </Transition>
      }
      <ExploreNotifications />
    </>
  );
};

export default WorldMapMenuModule;
