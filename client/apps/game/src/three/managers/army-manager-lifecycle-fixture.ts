import { destroyArmyManagerOwnedResources } from "./army-manager-ownership-lifecycle";

interface ArmyManagerLifecycleFixture {
  clearAllCalls: number;
  disposeCalls: {
    pathRenderer: number;
  };
  activeGuiFolders: number;
  destroy(): void;
}

export function createArmyManagerLifecycleFixture(): ArmyManagerLifecycleFixture {
  const clearAllCalls = 0;
  const disposeCalls = {
    pathRenderer: 0,
  };
  let activeGuiFolders = 3;
  const guiFolders = Array.from({ length: activeGuiFolders }, () => ({
    destroy: () => {
      activeGuiFolders -= 1;
    },
  }));

  return {
    get clearAllCalls() {
      return clearAllCalls;
    },
    disposeCalls,
    get activeGuiFolders() {
      return activeGuiFolders;
    },
    destroy() {
      destroyArmyManagerOwnedResources({
        pathRenderer: {
          dispose: () => {
            disposeCalls.pathRenderer += 1;
          },
        },
        guiFolders,
      });
    },
  };
}
