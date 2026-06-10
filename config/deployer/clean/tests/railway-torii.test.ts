import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, test } from "bun:test";
import {
  ensureRailwayIndexerDeployment,
  listRailwayToriiDeploymentNames,
  resolveRailwayToriiLiveState,
  type RailwayCommandRunner,
} from "../indexing/railway-torii";

function buildRailwayResult(options: {
  status?: number;
  stdout?: string;
  stderr?: string;
  error?: Error;
}): SpawnSyncReturns<string> {
  return {
    pid: 1,
    status: options.status ?? 0,
    stdout: options.stdout || "",
    stderr: options.stderr || "",
    error: options.error,
    output: [null, options.stdout || "", options.stderr || ""],
    signal: null,
  } as SpawnSyncReturns<string>;
}

describe("resolveRailwayToriiLiveState", () => {
  test("returns missing when the service cannot be linked", () => {
    const liveState = resolveRailwayToriiLiveState("etrn-mango", {
      railwayEnvironmentId: "env-1",
      railwayProjectId: "proj-1",
      railwayCommandRunner: ({ args }) => {
        if (args.join(" ") === "service etrn-mango --json") {
          return buildRailwayResult({
            status: 1,
            stderr: "Service not found",
          });
        }

        throw new Error(`Unexpected railway args: ${args.join(" ")}`);
      },
    });

    expect(liveState.state).toBe("missing");
    expect(liveState.stateSource).toBe("describe-not-found");
  });

  test("treats non-service lookup failures as indeterminate", () => {
    const liveState = resolveRailwayToriiLiveState("etrn-mango", {
      railwayEnvironmentId: "env-1",
      railwayProjectId: "proj-1",
      railwayCommandRunner: () =>
        buildRailwayResult({
          status: 1,
          stderr: "Environment not found",
        }),
    });

    expect(liveState.state).toBe("indeterminate");
    expect(liveState.stateSource).toBe("describe-and-list-failed");
  });

  test("captures the latest deployment status for existing services", () => {
    const liveState = resolveRailwayToriiLiveState("etrn-mango", {
      railwayEnvironmentId: "env-1",
      railwayProjectId: "proj-1",
      railwayCommandRunner: ({ args }) => {
        if (args.join(" ") === "service etrn-mango --json") {
          return buildRailwayResult({
            stdout: JSON.stringify({
              service: { id: "svc_123", name: "etrn-mango" },
              latestDeployment: { status: "CRASHED" },
            }),
          });
        }

        if (args.join(" ") === "domain --service etrn-mango --json") {
          return buildRailwayResult({
            stdout: JSON.stringify({ domain: "etrn-mango.up.railway.app" }),
          });
        }

        throw new Error(`Unexpected railway args: ${args.join(" ")}`);
      },
    });

    expect(liveState.state).toBe("existing");
    expect(liveState.deploymentStatus).toBe("CRASHED");
  });
});

describe("ensureRailwayIndexerDeployment", () => {
  test("creates the Railway service, configures it, and returns the generated domain", () => {
    const commands: string[] = [];
    let serviceLookupCount = 0;

    const railwayCommandRunner: RailwayCommandRunner = ({ args }) => {
      commands.push(args.join(" "));

      if (args.join(" ") === "service etrn-mango --json") {
        serviceLookupCount += 1;
        return serviceLookupCount === 1
          ? buildRailwayResult({
              status: 1,
              stderr: "Service not found",
            })
          : buildRailwayResult({
              stdout: JSON.stringify({
                service: {
                  id: "svc_123",
                  name: "etrn-mango",
                },
              }),
            });
      }

      if (args.join(" ") === "add --service etrn-mango --image ghcr.io/bibliothecadao/torii:v1.8.15") {
        return buildRailwayResult({
          stdout: "Created service etrn-mango",
        });
      }

      if (args.join(" ") === "volume add --service etrn-mango --environment env-1 --mount-path /data") {
        return buildRailwayResult({
          stdout: "Created volume",
        });
      }

      if (args[0] === "variables" && args[1] === "--service" && args[2] === "etrn-mango") {
        return buildRailwayResult({
          stdout: "Variables updated",
        });
      }

      if (args.join(" ") === "domain --service etrn-mango --json") {
        return buildRailwayResult({
          stdout: JSON.stringify({
            domain: "etrn-mango.up.railway.app",
          }),
        });
      }

      if (args.join(" ") === "redeploy --service etrn-mango --yes") {
        return buildRailwayResult({
          stdout: "Redeployed",
        });
      }

      throw new Error(`Unexpected railway args: ${args.join(" ")}`);
    };

    const result = ensureRailwayIndexerDeployment(
      {
        env: "slot",
        rpcUrl: "https://rpc.example",
        namespaces: "s1_eternum, ds_v1_2_0",
        worldName: "etrn-mango",
        worldAddress: "0x1234",
        externalContracts: ["erc721:0xabc", "erc20:0xdef"],
      },
      {
        railwayProjectId: "proj-1",
        railwayEnvironmentId: "env-1",
        railwayToriiImage: "ghcr.io/bibliothecadao/torii:v1.8.15",
        railwayVolumeMountPath: "/data",
        railwayCommandRunner,
      },
    );

    expect(result.action).toBe("created");
    expect(result.mode).toBe("railway-cli");
    expect(result.liveState.state).toBe("existing");
    expect(result.liveState.url).toBe("https://etrn-mango.up.railway.app");
    expect(commands[0]).toBe("service etrn-mango --json");
    expect(commands).toContain("add --service etrn-mango --image ghcr.io/bibliothecadao/torii:v1.8.15");
    expect(commands).toContain("volume add --service etrn-mango --environment env-1 --mount-path /data");
    expect(commands.some((command) => command.startsWith("variables --service etrn-mango --skip-deploys"))).toBe(true);
    expect(commands).toContain("domain --service etrn-mango --json");
    expect(commands).toContain("redeploy --service etrn-mango --yes");
    expect(commands[commands.length - 2]).toBe("service etrn-mango --json");
    expect(commands[commands.length - 1]).toBe("domain --service etrn-mango --json");
  });

  test("returns already-live without touching a fully configured service", () => {
    const commands: string[] = [];

    const railwayCommandRunner: RailwayCommandRunner = ({ args }) => {
      commands.push(args.join(" "));

      if (args.join(" ") === "service etrn-mango --json") {
        return buildRailwayResult({
          stdout: JSON.stringify({ service: { id: "svc_123", name: "etrn-mango" } }),
        });
      }

      if (args.join(" ") === "domain --service etrn-mango --json") {
        return buildRailwayResult({
          stdout: JSON.stringify({ domain: "etrn-mango.up.railway.app" }),
        });
      }

      if (args.join(" ") === "variables --service etrn-mango --json") {
        return buildRailwayResult({
          stdout: JSON.stringify({
            WORLD_ADDRESS: "0x1234",
            TORII_CONFIG_BASE64: "dG9ybWk=",
          }),
        });
      }

      throw new Error(`Unexpected railway args: ${args.join(" ")}`);
    };

    const result = ensureRailwayIndexerDeployment(
      {
        env: "slot",
        rpcUrl: "https://rpc.example",
        namespaces: "s1_eternum",
        worldName: "etrn-mango",
        worldAddress: "0x1234",
      },
      {
        railwayProjectId: "proj-1",
        railwayEnvironmentId: "env-1",
        railwayToriiImage: "ghcr.io/bibliothecadao/torii:v1.8.15",
        railwayCommandRunner,
      },
    );

    expect(result.action).toBe("already-live");
    expect(result.liveState.url).toBe("https://etrn-mango.up.railway.app");
    expect(commands.some((command) => command.startsWith("redeploy"))).toBe(false);
    expect(commands.some((command) => command.startsWith("add"))).toBe(false);
    expect(commands.some((command) => command.startsWith("volume"))).toBe(false);
  });

  test("repairs an existing but unconfigured service instead of reporting already-live", () => {
    const commands: string[] = [];

    const railwayCommandRunner: RailwayCommandRunner = ({ args }) => {
      commands.push(args.join(" "));

      if (args.join(" ") === "service etrn-mango --json") {
        return buildRailwayResult({
          stdout: JSON.stringify({ service: { id: "svc_123", name: "etrn-mango" } }),
        });
      }

      if (args.join(" ") === "domain --service etrn-mango --json") {
        return buildRailwayResult({
          stdout: JSON.stringify({ domain: "etrn-mango.up.railway.app" }),
        });
      }

      // Configuration probe: no variables set yet.
      if (args.join(" ") === "variables --service etrn-mango --json") {
        return buildRailwayResult({ stdout: JSON.stringify({}) });
      }

      // The half-created service already has its volume from the failed run.
      if (args.join(" ") === "volume add --service etrn-mango --environment env-1 --mount-path /data") {
        return buildRailwayResult({
          status: 1,
          stderr: "Volume already exists for this service",
        });
      }

      if (args[0] === "variables" && args.includes("--skip-deploys")) {
        return buildRailwayResult({ stdout: "Variables updated" });
      }

      if (args.join(" ") === "redeploy --service etrn-mango --yes") {
        return buildRailwayResult({ stdout: "Redeployed" });
      }

      throw new Error(`Unexpected railway args: ${args.join(" ")}`);
    };

    const result = ensureRailwayIndexerDeployment(
      {
        env: "slot",
        rpcUrl: "https://rpc.example",
        namespaces: "s1_eternum",
        worldName: "etrn-mango",
        worldAddress: "0x1234",
      },
      {
        railwayProjectId: "proj-1",
        railwayEnvironmentId: "env-1",
        railwayToriiImage: "ghcr.io/bibliothecadao/torii:v1.8.15",
        railwayVolumeMountPath: "/data",
        railwayCommandRunner,
      },
    );

    expect(result.action).toBe("repaired");
    expect(result.liveState.state).toBe("existing");
    expect(commands.some((command) => command.startsWith("add --service"))).toBe(false);
    expect(commands).toContain("volume add --service etrn-mango --environment env-1 --mount-path /data");
    expect(commands.some((command) => command.startsWith("variables --service etrn-mango --skip-deploys"))).toBe(true);
    expect(commands).toContain("redeploy --service etrn-mango --yes");
  });

  test("derives TORII_IMAGE_TAG from the configured image", () => {
    let variableArgs: string[] = [];
    let serviceLookupCount = 0;

    const railwayCommandRunner: RailwayCommandRunner = ({ args }) => {
      if (args.join(" ") === "service etrn-mango --json") {
        serviceLookupCount += 1;
        return serviceLookupCount === 1
          ? buildRailwayResult({ status: 1, stderr: "Service not found" })
          : buildRailwayResult({
              stdout: JSON.stringify({ service: { id: "svc_123", name: "etrn-mango" } }),
            });
      }

      if (args[0] === "variables" && args.includes("--skip-deploys")) {
        variableArgs = args;
        return buildRailwayResult({ stdout: "Variables updated" });
      }

      return buildRailwayResult({
        stdout: JSON.stringify({ domain: "etrn-mango.up.railway.app" }),
      });
    };

    ensureRailwayIndexerDeployment(
      {
        env: "slot",
        rpcUrl: "https://rpc.example",
        namespaces: "s1_eternum",
        worldName: "etrn-mango",
        worldAddress: "0x1234",
      },
      {
        railwayProjectId: "proj-1",
        railwayEnvironmentId: "env-1",
        railwayToriiImage: "ghcr.io/bibliothecadao/torii:v2.0.0-rc1",
        railwayCommandRunner,
      },
    );

    expect(variableArgs).toContain("TORII_IMAGE_TAG=v2.0.0-rc1");
  });
});

describe("listRailwayToriiDeploymentNames", () => {
  test("scopes service names to the configured prefixes", () => {
    const railwayCommandRunner: RailwayCommandRunner = ({ args }) => {
      if (args.join(" ") === "status --json") {
        return buildRailwayResult({
          stdout: JSON.stringify({
            services: [{ name: "etrn-mango" }, { name: "bltz-franky-01" }, { name: "postgres" }],
          }),
        });
      }

      throw new Error(`Unexpected railway args: ${args.join(" ")}`);
    };

    expect(
      listRailwayToriiDeploymentNames({
        railwayCommandRunner,
        railwayServicePrefixes: ["etrn-", "bltz-"],
      }),
    ).toEqual(["etrn-mango", "bltz-franky-01"]);

    expect(listRailwayToriiDeploymentNames({ railwayCommandRunner })).toEqual([
      "etrn-mango",
      "bltz-franky-01",
      "postgres",
    ]);
  });
});
