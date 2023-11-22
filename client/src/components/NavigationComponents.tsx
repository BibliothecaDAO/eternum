import Avatar from "../elements/Avatar";
import CircleButton from "../elements/CircleButton";
import { ReactComponent as WorldIcon } from "../assets/icons/common/world.svg";
import { ReactComponent as ForwardBurgerIcon } from "../assets/icons/common/forward-burger.svg";
import clsx from "clsx";
import { RealmSwitch } from "./cityview/RealmSwitch";
import { Link, useLocation } from "wouter";
import useUIStore from "../hooks/store/useUIStore";

const NavgationComponent = () => {
  const moveCameraToWorldMapView = useUIStore((state) => state.moveCameraToWorldMapView);

  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const isSideMenuOpened = useUIStore((state) => state.isSideMenuOpened);
  const toggleSideMenu = useUIStore((state) => state.toggleSideMenu);

  const [location] = useLocation();

  return (
    <div className="relative">
      <Avatar size="xl" className="relative z-10" src="/images/avatars/1.png" />
      <Link
        href="/map"
        onClick={() => {
          if (location !== "/map") setIsLoadingScreenEnabled(true);
          moveCameraToWorldMapView();
        }}
      >
        <CircleButton
          size="md"
          className={clsx("absolute z-0 text-[10px]", "top-0 left-16 ml-3", location.includes("/map") && "text-white")}
        >
          <WorldIcon className="fill-current" />
        </CircleButton>
      </Link>

      <CircleButton
        onClick={() => toggleSideMenu()}
        size="md"
        className={clsx("absolute z-0 text-[10px]", "top-16 mt-3")}
      >
        <ForwardBurgerIcon
          className={clsx("fill-current duration-300 transition-transform", isSideMenuOpened && "rotate-180")}
        />
      </CircleButton>
      <RealmSwitch className={clsx("absolute z-0 text-[10px]", "top-20 left-16 -ml-2 -mt-5")} />
    </div>
  );
};

export default NavgationComponent;
