import RealmManagementComponent from "../components/cityview/realm/RealmManagementComponent";
import { BaseContainer } from "../containers/BaseContainer";
import { useLevel } from "../hooks/helpers/useLevel";
import { useGetRealm } from "../hooks/helpers/useRealm";
import useRealmStore from "../hooks/store/useRealmStore";
import { Transition } from "@headlessui/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const RealmManagementModule = () => {
  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const { realm } = useGetRealm(realmEntityId);
  const { getEntityLevel } = useLevel();
  const [location] = useLocation();
  const [showMenu, setShowMenu] = useState(false);

  const level = realmEntityId ? getEntityLevel(realmEntityId) : { level: 1 };

  const levelImageNumber = useMemo(() => {
    if (level) {
      if (level.level === 0) return 1;
      if (level.level > 3) return 3;
      return level.level;
    }
    return 1;
  }, [level]);

  useEffect(() => {
    if (!location.includes("/map") && realm) {
      setShowMenu(true);
    } else {
      setShowMenu(false);
    }
  }, [location, realm]);

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
            <RealmManagementComponent />
            <div className="absolute rounded-t-xl top-0 left-0 z-0 h-[160px] overflow-hidden">
              <div className=" bg-gradient-to-b relative z-10 h-[160px] from-black to-black/70 w-full" />
              <img
                className="relative rounded-t-xl z-0 -translate-y-1/2"
                src={`/images/levels/tier${levelImageNumber}.png`}
              />
            </div>
          </BaseContainer>
        </Transition>
      }
    </>
  );
};

export default RealmManagementModule;
