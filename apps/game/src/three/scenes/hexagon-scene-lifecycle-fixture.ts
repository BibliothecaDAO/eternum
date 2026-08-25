import { destroyHexagonSceneOwnedManagers } from "./hexagon-scene-ownership-lifecycle";

interface HexagonSceneLifecycleFixture {
  disposeCalls: {
    frustumManager: number;
    visibilityManager: number;
  };
  destroy(): void;
}

export function createHexagonSceneLifecycleFixture(): HexagonSceneLifecycleFixture {
  const disposeCalls = {
    frustumManager: 0,
    visibilityManager: 0,
  };

  return {
    disposeCalls,
    destroy() {
      destroyHexagonSceneOwnedManagers({
        frustumManager: {
          dispose: () => {
            disposeCalls.frustumManager += 1;
          },
        },
        visibilityManager: {
          dispose: () => {
            disposeCalls.visibilityManager += 1;
          },
        },
      });
    },
  };
}
