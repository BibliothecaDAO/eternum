import useBlockchainStore, { TIME_PER_TICK } from "../hooks/store/useBlockchainStore";

export const TopMiddleNavigation = () => {
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  if (!nextBlockTimestamp) {
    return null;
  }

  const timeLeftBeforeNextTick = nextBlockTimestamp % TIME_PER_TICK;

  const progress = (timeLeftBeforeNextTick / TIME_PER_TICK) * 100;

  return (
    <div className="flex bg-brown rounded-b-3xl border-x-2 border-b border-gold pb-3 w-96  flex-wrap text-gold">
      {/* <div
        className="h-8 bg-gold rounded text-brown text-center flex justify-center"
        style={{ width: `${progress}%` }}
      ></div> */}
      <div className="self-center text-center w-full">{progress.toFixed()}%</div>
    </div>
  );
};
