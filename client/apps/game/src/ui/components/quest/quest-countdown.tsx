import { formatTime } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";

export const QuestCountdown = ({ endTimestamp }: { endTimestamp: number }) => {
  const [timeRemaining, setTimeRemaining] = useState(calculateTimeRemaining());

  function calculateTimeRemaining() {
    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, endTimestamp - currentTime);
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [endTimestamp]);

  return <span>{formatTime(timeRemaining)}</span>;
};
