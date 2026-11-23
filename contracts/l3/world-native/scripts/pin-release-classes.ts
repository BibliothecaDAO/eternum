import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hash } from "starknet";
import { NATIVE_RELEASES } from "../../../../deploy/release/native-release";

export type ReleasePin = { release: number; logic: Record<string, string> };

const REPIN = "bun contracts/l3/world-native/scripts/pin-release-classes.ts --write";

export function repinnedRelease(built: ReleasePin, pinned: ReleasePin, write: boolean): ReleasePin {
  const changed = Object.keys({ ...built.logic, ...pinned.logic }).filter(
    (name) => built.logic[name] !== pinned.logic[name],
  );
  if (built.release < pinned.release)
    throw new Error(`Release ${built.release} is older than the pinned release ${pinned.release}`);
  if (built.release === pinned.release && changed.length > 0)
    throw new Error(
      `Frontier logic classes ${changed.join(", ")} differ from release ${pinned.release}'s pin, and a shard refuses other classes under one release id: open release ${pinned.release + 1} in deploy/release/native-release.ts, then repin (${REPIN}).`,
    );
  if (built.release !== pinned.release && !write)
    throw new Error(`Release ${built.release} is not pinned (the pin holds release ${pinned.release}): ${REPIN}`);
  return built;
}

export function assertNoBuildPath(classes: Record<string, string>, checkout: string): void {
  const carried = Object.entries(classes).flatMap(([name, text]) =>
    [...new Set(text.match(/\{closure@[^}]*\}/g) ?? [])]
      .filter((closure) => closure.includes(checkout))
      .map((closure) => `${name}: ${closure.replace(checkout, "")}`),
  );
  if (carried.length > 0)
    throw new Error(
      `A closure the compiler keeps is named by its file's absolute path, so its class hash changes with the checkout's directory; write it as a match or a named function: ${carried.join("; ")}`,
    );
}

function builtRelease(): ReleasePin {
  const target = new URL("../target/dev/", import.meta.url);
  const classes = Object.fromEntries(
    readdirSync(target)
      .filter((file) => file.endsWith(".contract_class.json"))
      .map((file) => [file, readFileSync(new URL(file, target), "utf8")]),
  );
  assertNoBuildPath(classes, fileURLToPath(new URL("../../../../", import.meta.url)));
  const schema = JSON.parse(readFileSync(new URL("../schema/schema.json", import.meta.url), "utf8")) as {
    logicClasses: { name: string; contract: string }[];
  };
  return {
    release: NATIVE_RELEASES.frontier.release,
    logic: Object.fromEntries(
      schema.logicClasses.map(({ name, contract }) => [
        name,
        hash.computeSierraContractClassHash(JSON.parse(classes[`world_native_${contract}.contract_class.json`])),
      ]),
    ),
  };
}

if (import.meta.main) {
  const pin = new URL("../release-classes.json", import.meta.url);
  const write = process.argv.includes("--write");
  const release = repinnedRelease(builtRelease(), JSON.parse(readFileSync(pin, "utf8")) as ReleasePin, write);
  console.log(JSON.stringify(release));
  if (write) writeFileSync(pin, `${JSON.stringify(release, null, 2)}\n`);
}
