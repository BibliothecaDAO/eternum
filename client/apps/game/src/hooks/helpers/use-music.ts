import { useUIStore } from "@/hooks/store/use-ui-store";
import { useEffect } from "react";
import useSound from "use-sound";

// Define a type for your tracks
type Track = {
  name: string;
  url: string;
};

// Your tracks list
export const tracks: Track[] = [{ name: "Blitz", url: "/sound/music/minstrels/blitz.flac" }];

export const useMusicPlayer = () => {
  const isPlaying = useUIStore((state) => state.isPlaying);
  const setIsPlaying = useUIStore((state) => state.setIsPlaying);

  const isSoundOn = useUIStore((state) => state.isSoundOn);

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
    if (isSoundOn) {
      play();
    } else {
      stop();
    }

    return () => stop();
  }, [trackIndex, play, stop, isSoundOn]);

  return { play, stop, trackName, next, isPlaying };
};
