import { MusicRouterProvider } from "@/audio";

/** The app's playlist (the router's fallback for every page outside a match), loaded only while music is on. */
const MusicPlayer = () => <MusicRouterProvider>{null}</MusicRouterProvider>;

export default MusicPlayer;
