import { useState } from "react";
import { useAudio } from "../hooks/useAudio";
import { AudioCategory } from "../types";

export function AudioDemo() {
  const { play, setMasterVolume, setCategoryVolume, setMuted, getState, getMetrics, isReady } = useAudio();
  const [currentSound, setCurrentSound] = useState<string>("");

  const testSounds = [
    { id: "ui.click", name: "UI Click" },
    { id: "ui.whoosh", name: "UI Whoosh" },
    { id: "resource.collect.gold", name: "Collect Gold" },
    { id: "building.construct.castle", name: "Build Castle" },
    { id: "unit.march", name: "Unit March" },
    { id: "combat.victory", name: "Victory" },
    { id: "relic.chest", name: "Open Chest" },
    { id: "music.daybreak", name: "Daybreak Music" },
  ];

  const playSound = async (soundId: string) => {
    setCurrentSound(soundId);
    try {
      await play(soundId);
      console.log(`Played: ${soundId}`);
    } catch (error) {
      console.error(`Failed to play ${soundId}:`, error);
    }
  };

  const state = getState();
  const metrics = getMetrics();

  return (
    <div className="p-6 bg-gray-100 rounded-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">
        Audio System Demo {isReady ? "✅" : "⏳"}
      </h2>
      
      {!isReady && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
          <p className="text-yellow-800">Audio system initializing... Please wait.</p>
        </div>
      )}

      {/* Master Controls */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Master Controls</h3>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <span className="w-24">Master Volume:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={state?.masterVolume || 0}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="w-12 text-right">{Math.round((state?.masterVolume || 0) * 100)}%</span>
          </label>
          <button
            onClick={() => setMuted(!state?.muted)}
            className={`px-4 py-2 rounded ${state?.muted ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}
          >
            {state?.muted ? "Unmute" : "Mute"}
          </button>
        </div>
      </div>

      {/* Category Controls */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Category Volumes</h3>
        <div className="space-y-2">
          {Object.values(AudioCategory).map((category) => (
            <label key={category} className="flex items-center space-x-2">
              <span className="w-24 capitalize">{category}:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={state?.categoryVolumes[category] || 0}
                onChange={(e) => setCategoryVolume(category, parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="w-12 text-right">{Math.round((state?.categoryVolumes[category] || 0) * 100)}%</span>
            </label>
          ))}
        </div>
      </div>

      {/* Test Sounds */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Test Sounds</h3>
        <div className="grid grid-cols-2 gap-2">
          {testSounds.map((sound) => (
            <button
              key={sound.id}
              onClick={() => playSound(sound.id)}
              className={`p-2 rounded text-left ${
                currentSound === sound.id ? "bg-blue-500 text-white" : "bg-white hover:bg-gray-50 border"
              }`}
            >
              {sound.name}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Audio Metrics</h3>
        <div className="bg-white p-4 rounded border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>Active Instances: {metrics?.activeInstances || 0}</div>
            <div>Memory Usage: {metrics?.memoryUsageMB.toFixed(1) || 0} MB</div>
            <div>Pooled Instances: {metrics?.pooledInstances || 0}</div>
            <div>Cache Hit Ratio: {(metrics?.cacheHitRatio || 0) * 100}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
