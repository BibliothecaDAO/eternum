import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import net from "node:net";

function parseNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) {
    return { major: 0, minor: 0, patch: 0 };
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function isNodeAtLeast(major, minor, patch) {
  const current = parseNodeVersion(process.version);
  if (current.major !== major) {
    return current.major > major;
  }
  if (current.minor !== minor) {
    return current.minor > minor;
  }
  return current.patch >= patch;
}

async function findAvailablePort(startPort) {
  let port = startPort;

  while (true) {
    const isAvailable = await new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", () => {
        resolve(false);
      });

      server.once("listening", () => {
        server.close(() => resolve(true));
      });

      server.listen(port);
    });

    if (isAvailable) {
      return port;
    }

    port += 1;
  }
}

const gatewayPort = await findAvailablePort(8787);
const executorPort = await findAvailablePort(Math.max(8788, gatewayPort + 1));
const worldIngestPort = await findAvailablePort(Math.max(8789, executorPort + 1));
const gamePort = await findAvailablePort(5173);
const pnpmPath = execFileSync("which", ["pnpm"], { encoding: "utf8" }).trim();

const services = [
  {
    name: "agent-gateway",
    cmd: "pnpm",
    args: ["--dir", "./client/apps/agent-gateway", "dev"],
    env: {
      PORT: String(gatewayPort),
      AGENT_CLIENT_ORIGIN: `https://localhost:${gamePort}`,
    },
  },
  {
    name: "agent-executor",
    cmd: "pnpm",
    args: ["--dir", "./client/apps/agent-executor", "dev"],
    env: {
      PORT: String(executorPort),
    },
  },
  {
    name: "agent-world-ingest",
    cmd: "pnpm",
    args: ["--dir", "./client/apps/agent-world-ingest", "dev"],
    env: {
      PORT: String(worldIngestPort),
    },
  },
  {
    name: "game",
    cmd: isNodeAtLeast(20, 19, 0) ? "pnpm" : "npx",
    args: isNodeAtLeast(20, 19, 0)
      ? ["--dir", "./client/apps/game", "dev", "--host", "127.0.0.1", "--port", String(gamePort)]
      : [
          "-y",
          "node@20.19.0",
          pnpmPath,
          "--dir",
          "./client/apps/game",
          "dev",
          "--host",
          "127.0.0.1",
          "--port",
          String(gamePort),
        ],
    env: {
      VITE_PUBLIC_AGENT_GATEWAY_URL: `http://127.0.0.1:${gatewayPort}`,
    },
  },
];

console.log("[dev] starting local stack");
console.log(`[dev] agent-gateway     http://127.0.0.1:${gatewayPort}`);
console.log(`[dev] agent-executor    http://127.0.0.1:${executorPort}`);
console.log(`[dev] agent-world-ingest http://127.0.0.1:${worldIngestPort}`);
console.log(`[dev] game             http://127.0.0.1:${gamePort}`);

const children = services.map((service) => {
  const child = spawn(service.cmd, service.args, {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ...service.env,
    },
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[dev] ${service.name} exited from signal ${signal}`);
      return;
    }

    if (code && code !== 0) {
      console.error(`[dev] ${service.name} exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
});

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 250);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
