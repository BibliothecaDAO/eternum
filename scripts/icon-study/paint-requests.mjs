import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../../apps/game/asset-sources/icon-study-painted/", import.meta.url);
const { icons, directions } = JSON.parse(await readFile(new URL("catalog.json", root), "utf8"));
const shared = await readFile(new URL("style.txt", root), "utf8");
const requests = [];
for (const direction of directions) {
  const style = await readFile(new URL(`${direction.id}.txt`, root), "utf8");
  for (const icon of icons) {
    const subject = await readFile(new URL(icon.prompt, root), "utf8");
    requests.push({
      key: `${direction.id}/${icon.id}`,
      output: fileURLToPath(new URL(`masters/${direction.id}/${icon.id}.png`, root)),
      prompt: `${shared}\n${style}\n${subject}\nCreate a new painted replacement for the supplied old counterpart. The shipped stone and wheat paintings are material/lighting anchors only; improve their quality. One icon only, not a contact sheet.`,
      references: [...new Set([icon.old, "images/resources/1.png", "images/resources/35.png"])].map((path) =>
        fileURLToPath(new URL(`../../apps/game/public/${path}`, import.meta.url)),
      ),
      transparent: true,
    });
  }
}
console.log(JSON.stringify(requests, null, 2));
