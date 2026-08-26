// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("game entry bootstrap controller source", () => {
  it("records structured route rebootstrap success and failure breadcrumbs", () => {
    const source = readSource("src/game-entry/bootstrap-controller.ts");

    const forceFreshSuccessIndex = source.indexOf('event: "reconnect_success"');
    const forceFreshFailureIndex = source.indexOf('event: "reconnect_failure"');

    expect(source).toContain("addNetworkBreadcrumb");
    expect(forceFreshSuccessIndex).toBeGreaterThanOrEqual(0);
    expect(forceFreshFailureIndex).toBeGreaterThanOrEqual(0);
    expect(forceFreshSuccessIndex).toBeLessThan(forceFreshFailureIndex);
  });

  it("does not surface a deliberately superseded sync start as a bootstrap failure", () => {
    const controllerSource = readSource("src/game-entry/bootstrap-controller.ts");
    const bootstrapSource = readSource("src/init/bootstrap.tsx");

    expect(controllerSource).toContain("incomingError instanceof SupersededGameSyncStartError");
    expect(controllerSource.indexOf("incomingError instanceof SupersededGameSyncStartError")).toBeLessThan(
      controllerSource.indexOf('console.error("[bootstrap] game entry bootstrap failed"'),
    );
    expect(bootstrapSource.indexOf("error instanceof SupersededGameSyncStartError")).toBeLessThan(
      bootstrapSource.indexOf("bootstrapSession.clearFailure()"),
    );
  });
});
