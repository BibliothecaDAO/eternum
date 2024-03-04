import ProgressBar from "../../elements/ProgressBar";
import useBlockchainStore from "../../hooks/store/useBlockchainStore";

const TIME_PER_TICK = 60;

const EpochCountdown = () => {
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  if (!nextBlockTimestamp) {
    return null;
  }

  const timeLeftBeforeNextTick = nextBlockTimestamp % TIME_PER_TICK;

  const progress = (timeLeftBeforeNextTick / TIME_PER_TICK) * 100;

  // every
  const segments = 6;
  return (
    <div className="absolute left-0 right-0 flex items-center h-2 px-1 mx-4 space-x-1 bg-black rounded-full bottom-5">
      {[...Array(segments)].map((_, i) => (
        <ProgressBar progress={progress > (segments - i) * (100 / segments) ? 0 : 100} key={i} className="flex-1" />
      ))}
    </div>
  );
};

export default EpochCountdown;
