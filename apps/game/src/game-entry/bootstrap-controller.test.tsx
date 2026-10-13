import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const boot = vi.hoisted(() => ({
  settle: { resolve: (_session: unknown) => {}, reject: (_error: Error) => {} },
  lifecycle: {} as { onWorldSelectionStarted?: () => void; onWorldSelectionCompleted?: () => void },
}));
vi.mock("@/init/bootstrap", () => ({
  getCachedBootstrappedEntrySession: () => null,
  bootstrapGameForEntryContext: (_context: unknown, lifecycle: typeof boot.lifecycle) => {
    boot.lifecycle = lifecycle;
    return new Promise((resolve, reject) => (boot.settle = { resolve, reject }));
  },
}));
vi.mock("@/ui/layouts/game-entry-timeline", () => ({ markGameEntryMilestone: () => {} }));

import { useSyncStore } from "@/hooks/store/use-sync-store";
import { useGameEntryBootstrapController } from "./bootstrap-controller";
import type { ResolvedEntryContext } from "./context";

const CONTEXT = { chainId: "0x5245414c4d53", gameId: 1, intent: "play", autoSettle: false, source: "play-route" };

const mountController = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const seen = { renders: 0, state: null as ReturnType<typeof useGameEntryBootstrapController> | null };
  const Probe = () => {
    seen.renders += 1;
    seen.state = useGameEntryBootstrapController({
      context: CONTEXT as unknown as ResolvedEntryContext,
      enabled: true,
    });
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  return {
    seen,
    statuses: () => seen.state!.tasks.map((task) => `${task.id}:${task.status}`).join(" "),
    unmount: () => act(async () => root.unmount()),
  };
};

const reportSync = (progress: number) => act(async () => useSyncStore.getState().setInitialSyncProgress(progress));

afterEach(() => useSyncStore.getState().resetSubscriptions());

it("follows the boot through its stages without rendering again for a tick inside one", async () => {
  const controller = await mountController();
  expect(controller.statuses()).toBe("world:pending manifest:pending game:pending sync:pending renderer:pending");

  await act(async () => boot.lifecycle.onWorldSelectionStarted!());
  expect(controller.seen.state!.currentTask).toBe("world");
  await act(async () => boot.lifecycle.onWorldSelectionCompleted!());
  expect(controller.statuses()).toBe("world:complete manifest:running game:pending sync:pending renderer:pending");

  await reportSync(1);
  expect(controller.statuses()).toBe("world:complete manifest:complete game:complete sync:running renderer:pending");
  // The first snapshot reports once per model: sixty reports are one stage, and one stage is one picture.
  const rendersWhileSyncing = controller.seen.renders;
  for (let progress = 2; progress < 62; progress++) await reportSync(progress);
  expect(controller.seen.renders).toBe(rendersWhileSyncing);

  await reportSync(100);
  expect(controller.statuses()).toBe("world:complete manifest:complete game:complete sync:complete renderer:running");

  await act(async () => boot.settle.resolve({ setupResult: { ready: true } }));
  expect(controller.seen.state!.status).toBe("ready");
  expect(controller.seen.state!.setupResult).toEqual({ ready: true });
  expect(controller.statuses()).toBe("world:complete manifest:complete game:complete sync:complete renderer:complete");
  await controller.unmount();
});

it("marks the stage the boot failed in, and starts over on a retry", async () => {
  const failed = vi.spyOn(console, "error").mockImplementation(() => {});
  const controller = await mountController();
  await reportSync(40);
  await act(async () => boot.settle.reject(new Error("The world did not answer.")));
  expect(controller.seen.state!.error?.message).toBe("The world did not answer.");
  expect(controller.statuses()).toBe("world:complete manifest:complete game:complete sync:error renderer:pending");
  expect(controller.seen.state!.currentTask).toBeNull();

  await act(async () => useSyncStore.getState().setInitialSyncProgress(0));
  await act(async () => controller.seen.state!.retry());
  expect(controller.seen.state!.status).toBe("loading");
  expect(controller.statuses()).toBe("world:pending manifest:pending game:pending sync:pending renderer:pending");
  failed.mockRestore();
  await controller.unmount();
});
