import { useState, useEffect } from "react";
import useSound from "use-sound";
import useUIStore from "./store/useUIStore";

// Define a type for your tracks
type Track = {
  name: string;
  url: string;
};

// Your tracks list
const tracks: Track[] = [
  { name: "Day Break", url: "/sound/music/DayBreak.mp3" },
  { name: "Morning Ember", url: "/sound/music/MorningEmber.mp3" },
  { name: "Beyond The Horizon", url: "/sound/music/BeyondTheHorizon.mp3" },
  { name: "Celestial Shores", url: "/sound/music/CelestialShores.mp3" },
  { name: "Frostfall", url: "/sound/music/Frostfall.mp3" },
  { name: "Nomads Ballad", url: "/sound/music/NomadsBallad.mp3" },
  { name: "Rain Pool", url: "/sound/music/RainPool.mp3" },
  { name: "Shadow Song", url: "/sound/music/ShadowSong.mp3" },
  { name: "Shining Realms", url: "/sound/music/ShiningRealms.mp3" },
  { name: "Strangers Arrival", url: "/sound/music/StrangersArrival.mp3" },
  { name: "Twilight Harvest", url: "/sound/music/TwilightHarvest.mp3" },
  { name: "Wanderers Chronicle", url: "/sound/music/WanderersChronicle.mp3" },
];

export const useMusicPlayer = () => {
  const isPlaying = useUIStore((state) => state.isPlaying);
  const setIsPlaying = useUIStore((state) => state.setIsPlaying);

  const musicLevel = useUIStore((state) => state.musicLevel);

  const trackIndex = useUIStore((state) => state.trackIndex);
  const setTrackIndex = useUIStore((state) => state.setTrackIndex);
  const trackName = useUIStore((state) => state.trackName);
  const setTrackName = useUIStore((state) => state.setTrackName);

  const goToNextTrack = () => {
    const nextIndex = (trackIndex + 1) % tracks.length;
    setTrackIndex(nextIndex);
    setTrackName(tracks[nextIndex].name);
  };

  const next = async () => {
    stop();
    goToNextTrack();
  };

  const [play, { stop }] = useSound(tracks[trackIndex].url, {
    onplay: () => setIsPlaying(true),
    onstop: () => setIsPlaying(false),
    volume: musicLevel / 100,
    onend: () => {
      setIsPlaying(false);
      goToNextTrack();
    },
  });

  useEffect(() => {
    play();

    return () => stop();
  }, [trackIndex, play, stop]);

  return { play, stop, trackName, next, isPlaying };
};
