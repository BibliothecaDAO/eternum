import { useSeasonStart } from "@/hooks/use-season-start";

export const SeasonStartTimer = () => {
  const { seasonStart, countdown, nextBlockTimestamp } = useSeasonStart();
  if (countdown < 0 || nextBlockTimestamp === 0n || seasonStart === 0n) return null;

  const hours = Math.floor(Number(countdown) / 3600);
  const minutes = Math.floor((Number(countdown) % 3600) / 60);
  const seconds = Number(countdown) % 60;

  return (
    <div className="text-3xl text-primary font-semibold">
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  );
};
