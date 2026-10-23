// Records the editable source's SHA-256 on a compressed delivery's architecture node, editing only the GLB's JSON
// chunk so the compressed geometry and textures stay byte-identical.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [source, delivery] = process.argv.slice(2);
if (!source || !delivery) throw new Error("Provide the editable source and its compressed delivery");
const glb = readGlb(delivery);
const architecture = glb.json.nodes.find((node) => node.extras?.frontierPart === "architecture");
if (!architecture) throw new Error(`${delivery}: no architecture node`);
architecture.extras.sourceSha256 = createHash("sha256").update(readFileSync(source)).digest("hex");
writeGlb(delivery, glb);

function readGlb(path) {
  const bytes = readFileSync(path);
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error(`${path}: expected GLB`);
  const jsonLength = bytes.readUInt32LE(12);
  return {
    json: JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength)),
    rest: bytes.subarray(20 + jsonLength),
  };
}

function writeGlb(path, { json, rest }) {
  const text = Buffer.from(JSON.stringify(json), "utf8");
  const padded = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(20);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + rest.length, 8);
  header.writeUInt32LE(padded.length, 12);
  header.write("JSON", 16, "ascii");
  writeFileSync(path, Buffer.concat([header, padded, rest]));
}
