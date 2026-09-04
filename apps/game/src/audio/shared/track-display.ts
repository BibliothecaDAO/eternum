export const formatTrackDisplayName = (trackId: string | null) => {
  if (!trackId) return "Silence";
  return trackId
    .replace("music.", "")
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};
