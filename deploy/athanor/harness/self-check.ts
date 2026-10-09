#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { nativeCommandBits, type NativeCommand } from "../../../contracts/l3/world-native/schema/commands.gen";
import type { GameClient } from "@bibliothecadao/eternum";
import type { Account } from "starknet";
import { createHarnessGame } from "./harness-game";
import { verifyRouteReceipt } from "./self-check-action";
import deploymentFixture from "./self-check-fixture";

export interface RouteCase {
  command(): Promise<NativeCommand> | NativeCommand;
  route: NativeCommand["kind"];
  account: Account;
  client: GameClient;
  /** A deliberate domain refusal, never an admission revert or disabled route. */
  expectedRejection?: string;
  /** Assert domain effects from this client's authoritative Herald store after its transaction barrier. */
  verify(store: GameClient["setup"]["store"]): Promise<void> | void;
}

/** Deployment supplies launcher setup and route prerequisites; this port adds no guessed contract ABI. */
export interface DeploymentCheckPort {
  createThrowawayGame(stopped: AbortSignal): Promise<{ gameId: number; routes: RouteCase[]; dispose(): void }>;
}
export interface SelfCheckResult {
  passed: boolean;
  gameId?: number;
  firstFailedRoute?: string;
  elapsedMs: number;
  completed: string[];
  applied?: string[];
  refused?: string[];
}

export async function runSelfCheck(port: DeploymentCheckPort, timeoutMs = 120_000): Promise<SelfCheckResult> {
  const expectedRoutes = Object.keys(nativeCommandBits);
  const started = performance.now();
  const completed: string[] = [];
  const applied: string[] = [];
  const refused: string[] = [];
  const controller = new AbortController();
  let route = "create_throwaway_game";
  let game: Awaited<ReturnType<DeploymentCheckPort["createThrowawayGame"]>> | undefined;
  let passed = false;
  try {
    game = await bounded(port.createThrowawayGame(controller.signal), timeoutMs, route);
    if (!Number.isSafeInteger(game.gameId) || game.gameId <= 0) throw new Error("Invalid throwaway game");
    const planned = new Set(game.routes.map((item) => item.route));
    for (const required of expectedRoutes) {
      route = required;
      if (!planned.has(required as NativeCommand["kind"])) throw new Error("Missing route fixture");
    }
    for (const step of game.routes) {
      route = step.route;
      if (!expectedRoutes.includes(route) || step.client.gameId !== game.gameId) throw new Error("Invalid route scope");
      await bounded(checkRoute(step, controller.signal), timeoutMs, route);
      completed.push(route);
      (step.expectedRejection === undefined ? applied : refused).push(route);
    }
    passed = true;
  } catch {
    // Route identity is public; arbitrary exceptions from account setup may contain credentials.
  } finally {
    try {
      game?.dispose();
    } catch {
      passed = false;
      route = "dispose_throwaway_game";
    } finally {
      controller.abort();
    }
  }
  return {
    passed,
    gameId: game?.gameId,
    firstFailedRoute: passed ? undefined : route,
    elapsedMs: Math.round(performance.now() - started),
    completed,
    applied,
    refused,
  };
}

async function checkRoute(step: RouteCase, stopped: AbortSignal): Promise<void> {
  const command = await step.command();
  stopped.throwIfAborted();
  if (command.kind !== step.route) throw new Error("Fixture command differs from route");
  const provider = step.client.setup.network.provider;
  const sent = await createHarnessGame(step.client).submit(step.account, () =>
    provider.submitCommand(step.account, command),
  );
  if (!sent.confirmed) throw new Error("Route has no receipt completion barrier");
  if (step.expectedRejection === undefined) await sent.confirmed;
  else {
    // The normal action helper fails a refused action. The fixture still requires its receipt AND Herald refusal,
    // then asserts rollback; an arbitrary caught exception is never evidence that the route worked.
    await sent.confirmed.catch(() => {});
    await verifyRouteReceipt(step, sent.transactionHash, stopped);
  }
  stopped.throwIfAborted();
  await step.verify(step.client.setup.store);
}

async function bounded<T>(work: Promise<T>, timeoutMs: number, route: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Self-check timed out at ${route}`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

if (import.meta.main) {
  let result: SelfCheckResult;
  const started = performance.now();
  try {
    const { values } = parseArgs({
      options: { fixture: { type: "string" }, "timeout-ms": { type: "string", default: "120000" } },
    });
    const timeout = Number(values["timeout-ms"]);
    if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new Error("Positive timeout required");
    const port = values.fixture
      ? ((await import(pathToFileURL(resolve(values.fixture)).href)).default as DeploymentCheckPort)
      : deploymentFixture;
    result = await runSelfCheck(port, timeout);
  } catch {
    result = {
      passed: false,
      firstFailedRoute: "load_deployment_fixture",
      elapsedMs: Math.round(performance.now() - started),
      completed: [],
    };
  }
  console.log(JSON.stringify(result));
  process.exitCode = result.passed ? 0 : 1;
}
