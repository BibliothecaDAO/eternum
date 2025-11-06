// Generate factory set_config (audit) + deploy calldata for a world
import * as fs from "node:fs";
import * as path from "node:path";
import { byteArray, shortString } from "starknet";

interface Params {
  chain: string;
  worldName: string;
  version: string;
  namespace: string;
  maxActions: number;
  defaultNamespaceWriterAll: boolean;
}

function encodeByteArrayFromString(str: string): (string | number)[] {
  const ba = byteArray.byteArrayFromString(str);
  const data = Array.isArray(ba.data) ? ba.data : [];
  return [data.length, ...data, ba.pending_word ?? "0x0", ba.pending_word_len ?? 0];
}

function generateSetConfigCalldataFlat(manifest: any, p: Params): any[] {
  const out: any[] = [];
  out.push(p.version);
  out.push(p.maxActions);
  out.push(manifest.world.class_hash);
  out.push(...encodeByteArrayFromString(p.namespace));
  out.push(p.defaultNamespaceWriterAll ? 1 : 0);

  out.push(manifest.contracts.length);
  for (const c of manifest.contracts) {
    out.push(c.selector);
    out.push(c.class_hash);
    const n = Array.isArray(c.init_calldata) ? c.init_calldata.length : 0;
    out.push(n);
    if (n > 0) out.push(...c.init_calldata);
    out.push(0); // salt
    out.push(0); // unique
  }

  out.push(manifest.models.length);
  for (const m of manifest.models) out.push(m.class_hash);

  out.push(manifest.events.length);
  for (const e of manifest.events) out.push(e.class_hash);

  const libs = Array.isArray(manifest.libraries) ? manifest.libraries : [];
  out.push(libs.length);
  for (const lib of libs) {
    const classHash = lib.class_hash;
    let name = lib.name || "";
    const ver = lib.version || "";
    if (!name && lib.tag) {
      try {
        const afterNs = lib.tag.includes("-") ? lib.tag.split("-").slice(1).join("-") : lib.tag;
        const suffix = ver ? `_v${ver}` : "";
        name = afterNs.endsWith(suffix)
          ? afterNs.slice(0, afterNs.length - suffix.length)
          : afterNs;
      } catch {
        name = lib.tag;
      }
    }
    out.push(classHash);
    out.push(...encodeByteArrayFromString(name));
    out.push(...encodeByteArrayFromString(ver));
  }
  return out;
}

export async function generateFactoryCalldata(p: Params) {
  const manifestPath = `contracts/game/manifest_${p.chain}.json`;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const setConfig = generateSetConfigCalldataFlat(manifest, p);
  const deploy = [shortString.encodeShortString(p.worldName), p.version];

  const outDir = path.join("contracts/game/factory", p.chain, "calldata", p.worldName);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "set_config_calldata.txt"), setConfig.join(" "));
  fs.writeFileSync(path.join(outDir, "deploy_calldata.txt"), deploy.join(" "));
  fs.writeFileSync(path.join(outDir, "set_config_calldata.json"), JSON.stringify(setConfig, null, 2));
  fs.writeFileSync(path.join(outDir, "deploy_calldata.json"), JSON.stringify(deploy, null, 2));
}
