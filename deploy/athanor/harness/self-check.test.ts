import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import { expect, test } from "bun:test";
import { runSelfCheck, type DeploymentCheckPort } from "./self-check";

test("a short route plan cannot pass the deployment listing gate", async () => {
  let disposed = false;
  const result = await runSelfCheck(
    {
      createThrowawayGame: async () => ({
        gameId: 7,
        routes: [],
        dispose() {
          disposed = true;
        },
      }),
    },
    100,
  );
  expect(result).toMatchObject({ passed: false, firstFailedRoute: "CreateExplorer", completed: [], gameId: 7 });
  expect(disposed).toBe(true);
  expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
});
test("launcher setup timeout names the first failed route without exposing its exception", async () => {
  const result = await runSelfCheck({ createThrowawayGame: () => new Promise(() => {}) }, 10);
  expect(result.firstFailedRoute).toBe("create_throwaway_game");
  expect(result.passed).toBe(false);
});
test("even complete coverage refuses a route with the wrong game scope", async () => {
  const port = {
    createThrowawayGame: async () => ({
      gameId: 7,
      routes: Object.keys(nativeCommandBits).map((route) => ({ route, client: { gameId: 8 } })),
      dispose() {},
    }),
  } as unknown as DeploymentCheckPort;
  const result = await runSelfCheck(port, 100);
  expect(result).toMatchObject({ passed: false, firstFailedRoute: "CreateExplorer", completed: [] });
});
test("fixture failure emits only route and timing evidence", async () => {
  const result = await runSelfCheck(
    {
      createThrowawayGame: async () => {
        throw new Error("private setup input");
      },
    },
    100,
  );
  expect(JSON.stringify(result)).not.toContain("private setup input");
});
