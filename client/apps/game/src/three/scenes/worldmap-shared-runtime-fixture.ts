type ManagerName = "army" | "structure" | "chest";

interface ManagerUpdateCall {
  manager: ManagerName;
  chunkKey: string;
  options: {
    force: boolean;
    transitionToken: number;
  };
}

interface CreateWorldmapSharedRuntimeFixtureOptions {
  currentChunk?: string;
}

interface SnapshotAttachLifecycleOptions {
  sinceLastSnapshot?: boolean;
}

const LABEL_GROUP_NAMES = ["ArmyLabelsGroup", "StructureLabelsGroup", "ChestLabelsGroup"] as const;

export function createWorldmapSharedRuntimeFixture(options: CreateWorldmapSharedRuntimeFixtureOptions = {}) {
  const attachLifecycle: string[] = [];
  const detachLifecycle: string[] = [];
  const managerUpdateCalls: ManagerUpdateCall[] = [];
  let attachSnapshotIndex = 0;
  let currentChunk = options.currentChunk ?? "null";
  let isSwitchedOff = false;
  let transitionToken = 0;

  const attachLabelGroupsToScene = () => {
    LABEL_GROUP_NAMES.forEach((groupName) => {
      attachLifecycle.push(`scene:add:${groupName}`);
    });
  };

  const attachManagerLabels = () => {
    attachLifecycle.push("army:addLabelsToScene");
    attachLifecycle.push("structure:showLabels");
    attachLifecycle.push("chest:addLabelsToScene");
  };

  const detachLabelGroupsFromScene = () => {
    LABEL_GROUP_NAMES.forEach((groupName) => {
      detachLifecycle.push(`scene:remove:${groupName}`);
    });
  };

  const detachManagerLabels = () => {
    detachLifecycle.push("army:removeLabelsFromScene");
    detachLifecycle.push("structure:removeLabelsFromScene");
    detachLifecycle.push("chest:removeLabelsFromScene");
  };

  const fanOutManagerUpdate = async (chunkKey: string, force: boolean) => {
    transitionToken += 1;
    const options = {
      force,
      transitionToken,
    };

    (["army", "structure", "chest"] as const).forEach((manager) => {
      managerUpdateCalls.push({
        manager,
        chunkKey,
        options,
      });
    });

    await Promise.resolve();

    return transitionToken;
  };

  return {
    async setup(): Promise<void> {
      isSwitchedOff = false;
      attachLabelGroupsToScene();
      attachManagerLabels();
      await Promise.resolve();
    },
    async resume(): Promise<void> {
      isSwitchedOff = false;
      attachLabelGroupsToScene();
      attachManagerLabels();
      await Promise.resolve();
    },
    switchOff(): void {
      isSwitchedOff = true;
      detachLabelGroupsFromScene();
      detachManagerLabels();
    },
    snapshotAttachLifecycle(input: SnapshotAttachLifecycleOptions = {}): string[] {
      if (!input.sinceLastSnapshot) {
        attachSnapshotIndex = attachLifecycle.length;
        return [...attachLifecycle];
      }

      const snapshot = attachLifecycle.slice(attachSnapshotIndex);
      attachSnapshotIndex = attachLifecycle.length;
      return snapshot;
    },
    snapshotDetachLifecycle(): string[] {
      return [...detachLifecycle];
    },
    getCurrentChunk(): string {
      return currentChunk;
    },
    getManagerUpdateCalls(): ManagerUpdateCall[] {
      return [...managerUpdateCalls];
    },
    async switchToChunk(chunkKey: string): Promise<{ changedChunk: boolean; transitionToken: number }> {
      if (isSwitchedOff) {
        return {
          changedChunk: false,
          transitionToken,
        };
      }

      const changedChunk = currentChunk !== chunkKey;
      const nextTransitionToken = await fanOutManagerUpdate(chunkKey, false);
      currentChunk = chunkKey;

      return {
        changedChunk,
        transitionToken: nextTransitionToken,
      };
    },
    async refreshCurrentChunk(force: boolean): Promise<boolean> {
      if (isSwitchedOff || currentChunk === "null") {
        return false;
      }

      await fanOutManagerUpdate(currentChunk, force);
      return true;
    },
  };
}
