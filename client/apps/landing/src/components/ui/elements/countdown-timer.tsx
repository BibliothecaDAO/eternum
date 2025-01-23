import { TypeH1 } from "@/components/typography/type-h1";
import { useSeasonStart } from "@/hooks/use-season-start";

export function CountdownTimer() {
  const { seasonStart, countdown, currentBlockTimestamp } = useSeasonStart();

  const days = Math.floor(Number(countdown) / (3600 * 24));
  const hours = Math.floor((Number(countdown) % (3600 * 24)) / 3600);
  const minutes = Math.floor((Number(countdown) % 3600) / 60);
  const seconds = Number(countdown) % 60;

  if (countdown < 0 || currentBlockTimestamp === 0n || seasonStart === 0n) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Blurred overlay */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Timer container */}
      <div className="relative flex flex-col items-center">
        <img src="/images/logos/eternum-loader.png" className="w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2 mx-auto my-8" />

        <TypeH1 className="tracking-wider">Eternum is Launching in</TypeH1>
        <div className="flex gap-4 text-center mt-4 mx-auto">
          <TimeUnit value={days} label="Days" />
          <TimeUnit value={hours} label="Hours" />
          <TimeUnit value={minutes} label="Minutes" />
          <TimeUnit value={seconds} label="Seconds" />
        </div>
      </div>
    </div>
  );
}

interface TimeUnitProps {
  value: number;
  label: string;
}

function TimeUnit({ value, label }: TimeUnitProps) {
  return (
    <div className="flex flex-col">
      <span className="text-4xl font-bold">{value.toString().padStart(2, "0")}</span>
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}
