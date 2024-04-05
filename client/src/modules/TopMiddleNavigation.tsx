import useBlockchainStore from "../hooks/store/useBlockchainStore";
import { TIME_PER_TICK } from "../components/network/EpochCountdown";
import useUIStore from "@/hooks/store/useUIStore";
import { getColRowFromUIPosition } from "@/utils/utils";
import useRealmStore from "@/hooks/store/useRealmStore";
import { getRealmNameById } from "@/utils/realms";

export const TopMiddleNavigation = () => {
  const { hexData, highlightPositions } = useUIStore();
  const { realmId } = useRealmStore();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  if (!nextBlockTimestamp) {
    return null;
  }

  const timeLeftBeforeNextTick = nextBlockTimestamp % TIME_PER_TICK;

  const progress = (timeLeftBeforeNextTick / TIME_PER_TICK) * 100;

  const colRow = getColRowFromUIPosition(highlightPositions[0]?.[0], -highlightPositions[0]?.[1]);
  const radius = 20; // radius of the circle
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex bg-brown rounded-b-3xl border-x-2 border-b border-gold pb-3 w-[600px] text-gold px-4 justify-between">
      {/* <div
        className="h-8 bg-gold rounded text-brown text-center flex justify-center"
        style={{ width: `${progress}%` }}
      ></div> */}
      <div>
        <h3 className="self-center">{realmId ? getRealmNameById(realmId as any | "") : ""}</h3>
        <h6 className="text-xxs">{"0x...420"}</h6>
      </div>

      {/* <div className="self-center text-center w-full">{progress.toFixed()}%</div> */}

      <div className="absolute right-1/2 top-3">
        {" "}
        <svg className="progress-circle" width="50" height="50">
          <circle className="progress-circle__background" cx="25" cy="25" r={radius} fill="transparent" />
          <circle
            className="progress-circle__progress"
            cx="25"
            cy="25"
            r={radius}
            fill="black"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
      </div>

      <div className="flex space-x-2 self-center text-xs">
        <div className="">x: {colRow?.col ?? 0}</div>
        <div className="">y: {colRow?.row ?? 0}</div>
      </div>
    </div>
  );
};
