import { destroyHexagonSceneOwnedManagers } from "./hexagon-scene-ownership-lifecycle";

interface HexagonSceneLifecycleFixture {
  disposeCalls: {
    visibilityManager: number;
  };
  destroy(): void;
}

export function createHexagonSceneLifecycleFixture(): HexagonSceneLifecycleFixture {
  const disposeCalls = {
    visibilityManager: 0,
  };

  return {
    disposeCalls,
    destroy() {
      destroyHexagonSceneOwnedManagers({
        visibilityManager: {
          dispose: () => {
            disposeCalls.visibilityManager += 1;
          },
        },
      });
    },
  };
}
