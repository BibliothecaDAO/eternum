import { useState, useEffect } from "react";
import useSound from "use-sound";

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
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [trackName, setTrackName] = useState(tracks[0].name);
  const [isPlaying, setIsPlaying] = useState(false); // Added state to track if music is playing

  const goToNextTrack = () => {
    setCurrentTrackIndex((prevIndex) => {
      const nextIndex = (prevIndex + 1) % tracks.length;
      setTrackName(tracks[nextIndex].name);
      return nextIndex;
    });
  };

  const next = () => {
    goToNextTrack();
    play();
  };

  const [play, { stop }] = useSound(tracks[currentTrackIndex].url, {
    onplay: () => setIsPlaying(true), // Set isPlaying to true when the track starts playing
    onstop: () => setIsPlaying(false), // Set isPlaying to false when the track stops
    onend: () => {
      setIsPlaying(false); // Also set isPlaying to false when the track ends
      goToNextTrack();
    },
  });

  useEffect(() => {
    play();
    return () => stop();
  }, [currentTrackIndex, play, stop]);

  return { play, stop, trackName, next, isPlaying }; // Include checkIsPlaying in the returned object
};
