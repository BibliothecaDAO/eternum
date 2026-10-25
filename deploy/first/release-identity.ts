/**
 * The release this commit ships, as the box half built it: the facts its init image baked (`release.json` in the run
 * directory). The Cloudflare half cannot compile contracts, so it trusts the box's build only when that build's release
 * sources are this commit's; the launch Worker then holds the shard's registered release and Herald's mapping to it.
 */
import { boxRead } from "./box";
import { PublicError } from "./errors";
import { command, CommandFailure, shell } from "./process";
import type { Target } from "./settings";
import type { PrivateStore } from "./private-store";
import { NATIVE_RELEASE_ID } from "../release/native-release";
import type { ReleaseIdentity } from "../../apps/launch-service/src/operator-api";

/**
 * Every file that decides a release's identity: the world's contracts and the packages they build with (Scarb path
 * dependencies), its schema, the release id, and the image that compiles them at a fixed path with a fixed toolchain.
 */
export const RELEASE_SOURCES = [
  "contracts/l3/world-native",
  "contracts/l3/vrf-verifier",
  "deploy/release/native-release.ts",
  "deploy/shard/Dockerfile",
];

/** Where the checkout's run leaves the identity for the export that publishes, beside the commit it was read for. */
const RELEASE_IDENTITY = "release-identity.json";

/** Read in the checkout, which has git and the box's SSH alias, before the commit is exported and published. */
export async function recordReleaseIdentity(store: PrivateStore, target: Target, commit: string) {
  store.write(RELEASE_IDENTITY, { commit, release: await verifiedReleaseIdentity(target, commit) });
}

/** The identity recorded for exactly this commit; another commit's never stands in. */
export function readReleaseIdentity(store: PrivateStore, commit: string): ReleaseIdentity | null {
  const recorded = store.read<{ commit: string; release: ReleaseIdentity | null }>(RELEASE_IDENTITY);
  if (recorded?.commit !== commit)
    throw new PublicError(
      "No release identity was read for this commit; run pnpm run deploy:cloudflare from the checkout",
    );
  return recorded.release;
}

/** What the box records of its last build, as far as the release goes. */
interface BoxBuild {
  commit: string;
  releaseId: number;
  schema: string;
  migrationClassHash: string;
  classes: { logic: Record<string, string> };
}

/** This commit's release identity from the box's build, or null when the box has never built (a first deployment). */
async function verifiedReleaseIdentity(target: Target, commit: string): Promise<ReleaseIdentity | null> {
  const build = await boxBuild(target);
  if (!build) return null;
  if (build.releaseId !== NATIVE_RELEASE_ID)
    throw new PublicError(
      `The box half built release ${build.releaseId}; this commit ships release ${NATIVE_RELEASE_ID}. Run the box half at this commit first.`,
    );
  if (build.commit !== commit && (await releaseSourcesDiffer(build.commit, commit)))
    throw new PublicError(
      `The box half built ${build.commit.slice(0, 11)}, whose release sources differ from this commit's. Run the box half at this commit first.`,
    );
  return {
    releaseId: build.releaseId,
    schema: build.schema,
    logic: build.classes.logic,
    migration: build.migrationClassHash,
  };
}

async function boxBuild(target: Target): Promise<BoxBuild | null> {
  const record = `${target.runDirectory}/release.json`;
  const output = await boxRead(target, `if [ -f ${shell(record)} ]; then cat ${shell(record)}; else echo null; fi`);
  return JSON.parse(output) as BoxBuild | null;
}

/** The box builds pushed commits only, so its commit is fetched here before the two are compared. */
async function releaseSourcesDiffer(built: string, commit: string): Promise<boolean> {
  if (!/^[0-9a-f]{40}$/.test(built)) throw new PublicError("The box half's build record names no commit");
  await command({ argv: ["git", "fetch", "--quiet", "origin", built] });
  try {
    await command({ argv: ["git", "diff", "--quiet", built, commit, "--", ...RELEASE_SOURCES] });
    return false;
  } catch (error) {
    if (error instanceof CommandFailure) return true;
    throw error;
  }
}
