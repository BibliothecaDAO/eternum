import { useState } from "react";
import Button from "./Button";
import { useMusicPlayer } from "../hooks/useMusic";

export const MusicPlayer = () => {
  const { play, next, trackName, isPlaying, stop } = useMusicPlayer();

  const [loaded, setLoaded] = useState(false);

  const handlePlay = () => {
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  };

  return (
    <>
      {!loaded && <div onClick={() => setLoaded(true)} className="h-full w-full absolute backdrop-blur-sm"></div>}

      <div className="absolute top-10 left-10 flex space-x-3 rounded-md p-2 backdrop-blur-lg">
        <Button onClick={() => handlePlay()} variant={"primary"} className="self-center">
          {isPlaying ? "Pause" : "Play"}
        </Button>

        <div className="self-center w-72">
          {trackName} <div className="text-xs opacity-70">Casey Wescott</div>{" "}
        </div>

        <Button onClick={() => next()} variant={"primary"} className="self-center">
          Next
        </Button>
      </div>
    </>
  );
};
