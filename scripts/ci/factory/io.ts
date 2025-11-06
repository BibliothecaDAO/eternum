import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(__dirname ?? import.meta.dir, "../../../");

export function readDeployment(chain: string): any[] {
  const file = path.join(repoRoot, `contracts/game/factory/${chain}/deployment.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

export function writeDeployment(chain: string, s: any[]) {
  const dir = path.join(repoRoot, `contracts/game/factory/${chain}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `deployment.json`), JSON.stringify(s, null, 2));
}

export function readArchive(chain: string): any[] {
  const file = path.join(repoRoot, `contracts/game/factory/${chain}/old-deployments.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

export function writeArchive(chain: string, s: any[]) {
  const dir = path.join(repoRoot, `contracts/game/factory/${chain}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `old-deployments.json`), JSON.stringify(s, null, 2));
}

export function calldataDir(chain: string, worldName: string) {
  return path.join(repoRoot, `contracts/game/factory/${chain}/calldata/${worldName}`);
}

