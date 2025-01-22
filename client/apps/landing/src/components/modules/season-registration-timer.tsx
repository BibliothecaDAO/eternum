import { useLeaderboardStatus } from "@/hooks/use-prize-claim";
import { useEffect, useState } from "react";

export const SeasonRegistrationTimer = () => {
  const [timeLeft, setTimeLeft] = useState({ hours: "00", minutes: "00", seconds: "00" });

  const { leaderboard } = useLeaderboardStatus();

  const registrationEnd = leaderboard?.registration_end_timestamp;

  useEffect(() => {
    if (!registrationEnd) return;

    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const end = Number(registrationEnd);
      if (now >= end) {
        setTimeLeft({ hours: "00", minutes: "00", seconds: "00" });
        clearInterval(timer);
        return;
      }

      const diff = end - now;
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      setTimeLeft({
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
        seconds: String(seconds).padStart(2, "0"),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [registrationEnd]);

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 text-center flex flex-row gap-2 items-baseline">
      <h2 className="text-2xl font-bold text-primary mb-4 font-">Registration Countdown: </h2>
      <div className="text-3xl text-primary font-semibold">
        {timeLeft.hours}:{timeLeft.minutes}:{timeLeft.seconds}
      </div>
    </div>
  );
};
