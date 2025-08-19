import { useAudio, useMusicPlayer } from "@/audio";

export function QuickAudioTest() {
  const { play, isReady } = useAudio();
  const { trackName, next, isPlaying } = useMusicPlayer();

  return (
    <div className="p-4 bg-gray-800 text-white">
      <h3>Audio System Status</h3>
      <p>Ready: {isReady ? "✅" : "❌"}</p>
      <p>Current Track: {trackName}</p>
      <p>Playing: {isPlaying ? "🎵" : "⏸️"}</p>
      
      <div className="mt-4 space-x-2">
        <button 
          onClick={() => play('ui.click')}
          className="px-4 py-2 bg-blue-600 rounded"
        >
          Test Click
        </button>
        <button 
          onClick={next}
          className="px-4 py-2 bg-green-600 rounded"
        >
          Next Track
        </button>
      </div>
    </div>
  );
}