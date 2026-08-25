import { getSyncSimulator } from "@/dojo/sync-simulator";
import { BiomeType } from "@bibliothecadao/types";
import type GUI from "lil-gui";

/**
 * Configuration for the performance simulation helper
 */
interface WorldmapPerfSimulationConfig {
  guiFolder: GUI;
  getSimulateAllExplored: () => boolean;
  setSimulateAllExplored: (value: boolean) => void;
  getRenderChunkSize: () => { width: number; height: number };
  requestChunkRefresh: (force: boolean) => void;
  hashCoordinates: (x: number, y: number) => number;
}

/**
 * Performance simulation helper for WorldmapScene.
 * Provides debug GUI controls for benchmarking and testing.
 */
export class WorldmapPerfSimulation {
  private config: WorldmapPerfSimulationConfig;

  constructor(config: WorldmapPerfSimulationConfig) {
    this.config = config;
  }

  /**
   * Setup GUI controls for performance simulation
   */
  setupPerformanceSimulationGUI(): void {
    const perfFolder = this.config.guiFolder.addFolder("Perf Simulation");

    // Create a state object for the GUI binding
    const simulationState = {
      simulateAllExplored: this.config.getSimulateAllExplored(),
    };

    perfFolder
      .add(simulationState, "simulateAllExplored")
      .name("Show All Biomes")
      .onChange((value: boolean) => {
        console.log(`[Performance] Simulate all explored: ${value}`);
        this.config.setSimulateAllExplored(value);
        this.config.requestChunkRefresh(true);
      });

    // Render-size is fixed at runtime to keep scene/model/manager bounds in sync.
    const renderChunkSize = this.config.getRenderChunkSize();
    const renderSizeState = {
      renderSize: `${renderChunkSize.width}x${renderChunkSize.height}`,
    };
    perfFolder.add(renderSizeState, "renderSize").name("Render Size (Fixed)");

    // Sync simulation controls
    this.setupSyncSimulationGUI(perfFolder);

    perfFolder.close();
  }

  /**
   * Setup GUI controls for sync traffic simulation
   */
  private setupSyncSimulationGUI(parentFolder: GUI): void {
    const syncFolder = parentFolder.addFolder("Sync Simulation");
    const simulator = getSyncSimulator();

    // Control state object for GUI binding
    const syncControls = {
      entitiesPerSecond: 100,
      burstSize: 10,
      injectIntoECS: true,
      running: false,
      startStop: () => {
        if (simulator.isRunning()) {
          simulator.stop();
          syncControls.running = false;
        } else {
          simulator.updateConfig({
            entitiesPerSecond: syncControls.entitiesPerSecond,
            burstSize: syncControls.burstSize,
            injectIntoECS: syncControls.injectIntoECS,
            logging: false,
          });
          simulator.start();
          syncControls.running = true;
        }
      },
      burst100: () => {
        simulator.updateConfig({ injectIntoECS: syncControls.injectIntoECS });
        simulator.burst(100);
      },
      burst1000: () => {
        simulator.updateConfig({ injectIntoECS: syncControls.injectIntoECS });
        simulator.burst(1000);
      },
      logStats: () => {
        simulator.logStats();
      },
    };

    syncFolder.add(syncControls, "entitiesPerSecond", 10, 1000, 10).name("Entities/sec");
    syncFolder.add(syncControls, "burstSize", 1, 100, 1).name("Burst Size");
    syncFolder.add(syncControls, "injectIntoECS").name("Inject into ECS");
    syncFolder.add(syncControls, "startStop").name("Start/Stop Sync");
    syncFolder.add(syncControls, "burst100").name("Burst 100");
    syncFolder.add(syncControls, "burst1000").name("Burst 1000");
    syncFolder.add(syncControls, "logStats").name("Log Stats");

    syncFolder.close();
  }

  /**
   * Generate a deterministic biome type for unexplored hexes during simulation.
   * Uses the same hash function as other visual randomization for consistency.
   */
  getSimulatedBiome(col: number, row: number): BiomeType {
    // Use hash to generate deterministic but varied biomes
    const hash = this.config.hashCoordinates(col * 7.31, row * 13.17);

    // Distribute across biome types (excluding special types)
    const biomeTypes = [
      BiomeType.DeepOcean,
      BiomeType.Ocean,
      BiomeType.Beach,
      BiomeType.Scorched,
      BiomeType.Bare,
      BiomeType.Tundra,
      BiomeType.Snow,
      BiomeType.TemperateDesert,
      BiomeType.Shrubland,
      BiomeType.Taiga,
      BiomeType.Grassland,
      BiomeType.TemperateDeciduousForest,
      BiomeType.TemperateRainForest,
      BiomeType.SubtropicalDesert,
      BiomeType.TropicalSeasonalForest,
      BiomeType.TropicalRainForest,
    ];

    const index = Math.floor(hash * biomeTypes.length);
    return biomeTypes[index];
  }
}
