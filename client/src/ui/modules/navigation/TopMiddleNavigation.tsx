import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { getColRowFromUIPosition } from "@/ui/utils/utils";
import useRealmStore from "@/hooks/store/useRealmStore";
import { getRealmNameById } from "@/ui/utils/realms";
import { TIME_PER_TICK } from "@bibliothecadao/eternum";
import { useQuery } from "@/hooks/helpers/useQuery";
import CircleButton from "@/ui/elements/CircleButton";
import { BuildingThumbs } from "./LeftNavigationModule";
import { useLocation } from "wouter";
import { useHexPosition } from "@/hooks/helpers/useHexPosition";
import { assistant, quests } from "@/ui/components/navigation/Config";
import { Compass } from "@/ui/components/worldmap/Compass";
import { Headline } from "@/ui/elements/Headline";

export const TopMiddleNavigation = () => {
  const { hexPosition } = useQuery();
  const { highlightPositions, moveCameraToColRow, isPopupOpen, togglePopup } = useUIStore();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { realmId } = useRealmStore();
  const [location, setLocation] = useLocation();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { realm } = useHexPosition();

  if (!nextBlockTimestamp) {
    return null;
  }

  const timeLeftBeforeNextTick = nextBlockTimestamp % TIME_PER_TICK;

  const progress = (timeLeftBeforeNextTick / TIME_PER_TICK) * 100;

  const colRow = getColRowFromUIPosition(highlightPositions[0]?.pos[0], -highlightPositions[0]?.pos[1]);
  const radius = 20; // radius of the circle
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex">
      {location === "/map" && (
        <div className="flex mr-4">
          <Compass />
        </div>
      )}
      <div className="self-center text-center text-xl p-4 second-step bg-gold/50 text-brown border m-2">
        {progress.toFixed()}%
      </div>
      <div className="flex bg-brown/90  border-gradient  p-3 px-24 text-gold  justify-center border-gold/50 border-b-2 text-center">
        <div className="self-center ">
          <Headline>
            <h5 className="self-center uppercase">{realmId ? getRealmNameById(realmId as any | "") : ""}</h5>
          </Headline>

          {/* <h6>{"0x...420"}</h6> */}
        </div>

        {/* <div className="flex flex-col self-center font-bold">
          <div className="">
            x: {hexPosition.col !== 0 ? hexPosition.col.toLocaleString() : colRow?.col.toLocaleString()}
          </div>
          <div className="">
            y: {hexPosition.row !== 0 ? hexPosition.row.toLocaleString() : colRow?.row.toLocaleString()}
          </div>
        </div> */}
      </div>
      <div className="self-center px-3 flex space-x-2">
        {/* <CircleButton
          image={BuildingThumbs.squire}
          label={assistant}
          active={isPopupOpen(assistant)}
          size="xl"
          onClick={() => togglePopup(assistant)}
        /> */}
        <CircleButton
          image={BuildingThumbs.squire}
          label={quests}
          active={isPopupOpen(quests)}
          size="xl"
          onClick={() => togglePopup(quests)}
        />
      </div>
    </div>
  );
};
