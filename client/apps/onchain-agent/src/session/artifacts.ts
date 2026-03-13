import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { WorldProfile } from "../world/types";

interface AuthMetadata {
  url: string;
  status: "pending" | "active" | "expired" | "none";
  worldName: string;
  chain: string;
  createdAt: string;
  expiresAt?: string;
  address?: string;
}

interface WorldArtifacts {
  profile: WorldProfile;
  manifest: { contracts: unknown[] };
  policy: Record<string, unknown>;
  auth: AuthMetadata;
}

export function writeArtifacts(worldDir: string, artifacts: WorldArtifacts): void {
  mkdirSync(worldDir, { recursive: true });
  writeFileSync(path.join(worldDir, "profile.json"), JSON.stringify(artifacts.profile, null, 2));
  writeFileSync(path.join(worldDir, "manifest.json"), JSON.stringify(artifacts.manifest, null, 2));
  writeFileSync(path.join(worldDir, "policy.json"), JSON.stringify(artifacts.policy, null, 2));
  writeFileSync(path.join(worldDir, "auth.json"), JSON.stringify(artifacts.auth, null, 2));
}

export function readArtifacts(worldDir: string): WorldArtifacts {
  return {
    profile: JSON.parse(readFileSync(path.join(worldDir, "profile.json"), "utf-8")),
    manifest: JSON.parse(readFileSync(path.join(worldDir, "manifest.json"), "utf-8")),
    policy: JSON.parse(readFileSync(path.join(worldDir, "policy.json"), "utf-8")),
    auth: JSON.parse(readFileSync(path.join(worldDir, "auth.json"), "utf-8")),
  };
}

export function readAuthStatus(worldDir: string): AuthMetadata {
  const authPath = path.join(worldDir, "auth.json");
  if (!existsSync(authPath)) {
    return { url: "", status: "none", worldName: "", chain: "", createdAt: "" };
  }
  return JSON.parse(readFileSync(authPath, "utf-8"));
}

export function updateAuthStatus(worldDir: string, updates: Partial<AuthMetadata>): void {
  const current = readAuthStatus(worldDir);
  const updated = { ...current, ...updates };
  writeFileSync(path.join(worldDir, "auth.json"), JSON.stringify(updated, null, 2));
}
