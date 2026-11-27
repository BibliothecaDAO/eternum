import { createBrowserScheduler } from "@/sync/browser-scheduler";
import { createGameClient } from "@bibliothecadao/eternum";
import { installFreshGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { getPlayerDisplayName } from "@/services/identity/player-profiles";

type BrowserGameInput = Pick<Parameters<typeof createGameClient>[0], "shard" | "gameId" | "observer" | "authHandler">;

/**
 * Renderer boot and settlement use the same deployment and Herald store; actions are the connected gameplay account's
 * own signed invokes.
 */
export async function createBrowserGameClient(input: BrowserGameInput, assertCurrent?: () => void) {
  // The compiled bindings load when a game is entered, never with the landing.
  const { nativeBindings } = await import("@/runtime/world/native-bindings");
  assertCurrent?.();
  return createGameClient({
    ...input,
    playerNames: getPlayerDisplayName,
    bindings: nativeBindings,
    scheduler: createBrowserScheduler(),
    // The scenes and hooks read the game's sync runtime as the active one.
    createRuntime: () => {
      assertCurrent?.();
      return installFreshGameSyncRuntime();
    },
  });
}
