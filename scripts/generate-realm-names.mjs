import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("client/public/jsons/realms.json");
const targetPath = path.resolve("client/public/jsons/realm-names.json");

const realms = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const realmNames = Object.fromEntries(
  Object.entries(realms).map(([id, realm]) => [id, typeof realm?.name === "string" ? realm.name : ""]),
);

fs.writeFileSync(targetPath, JSON.stringify(realmNames));

console.log(`Generated ${targetPath} with ${Object.keys(realmNames).length} realm names.`);
