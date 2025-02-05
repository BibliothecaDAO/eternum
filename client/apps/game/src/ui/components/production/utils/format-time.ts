export const formatTime = (ticks: number): string => {
  const days = Math.floor(ticks / (24 * 60 * 60));
  const hours = Math.floor((ticks % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((ticks % (60 * 60)) / 60);
  const seconds = ticks % 60;

  return [
    days > 0 ? `${days}d ` : "",
    hours > 0 ? `${hours}h ` : "",
    minutes > 0 ? `${minutes}m ` : "",
    `${seconds}s`,
  ].join("");
};
