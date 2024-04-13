import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { getColRowFromUIPosition } from "@/ui/utils/utils";
import useRealmStore from "@/hooks/store/useRealmStore";
import { getRealmNameById } from "@/ui/utils/realms";
import { TIME_PER_TICK } from "@bibliothecadao/eternum";
import { useQuery } from "@/hooks/helpers/useQuery";

export const TopMiddleNavigation = () => {
  const { hexPosition } = useQuery();
  const { highlightPositions } = useUIStore();
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
    <div className="flex bg-black/70 rounded-b  p-3 w-[600px] text-gold px-4 justify-between border-gold/50 border-b-2">
      <div>
        <h3 className="self-center">{realmId ? getRealmNameById(realmId as any | "") : ""}</h3>
        <h6>{"0x...420"}</h6>
      </div>

      {/* <div className="self-center text-center w-full">{progress.toFixed()}%</div> */}

      <div className="absolute right-1/2 top-16">
        {" "}
        <svg className="progress-circle" width="50" height="50">
          <circle
            className="progress-circle__progress"
            cx="25"
            cy="25"
            r={radius}
            fill="white"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
      </div>

      <div className="flex flex-col self-center font-bold">
        <div className="">
          x: {hexPosition.col !== 0 ? hexPosition.col.toLocaleString() : colRow?.col.toLocaleString()}
        </div>
        <div className="">
          y: {hexPosition.row !== 0 ? hexPosition.row.toLocaleString() : colRow?.row.toLocaleString()}
        </div>
      </div>
    </div>
  );
};
