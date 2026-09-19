import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateNativeTarget(environment = process.env) {
  const path = environment.NATIVE_WORLD_MANIFEST?.trim();
  const admission = environment.ADMISSION_URL?.trim();
  if (!path) throw new Error("NATIVE_WORLD_MANIFEST is required");
  if (!admission) throw new Error("ADMISSION_URL is required");
  const url = new URL(admission);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("ADMISSION_URL must be an HTTP endpoint without credentials");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const release = manifest.native;
  if (release?.version !== 1 || !release.activeSchema || !release.schemas?.[release.activeSchema])
    throw new Error("Deployment requires a native release manifest");
  const schema = release.schemas[release.activeSchema];
  if (schema.identity !== release.activeSchema || !schema.domains?.season || !schema.domains?.registry)
    throw new Error("Native release schema is incomplete");
  for (const domain of Object.keys(schema.domains)) {
    const address = release.domains?.[domain]?.address;
    if (!address || !/^0x[0-9a-f]+$/i.test(address) || BigInt(address) <= 0n)
      throw new Error(`Native release has no deployed ${domain} address`);
  }
  if (BigInt(manifest.world?.address ?? 0) !== BigInt(release.domains.season.address))
    throw new Error("Native world address differs from its season domain");
  return { worldAddress: manifest.world.address, schema: release.activeSchema, admissionUrl: url.toString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify({ event: "native_target_validated", ...validateNativeTarget() }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
