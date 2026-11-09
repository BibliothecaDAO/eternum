// Writes the app's offline page into the web directory before every `cap copy` (the `capacitor:copy:before` hook): the
// game's own offline page (apps/game/public/offline.html) and its icon, with Try again opening the live site. In the
// game the page answers the address that failed, so reloading it retries that address; in the app Capacitor shows it
// from its own `capacitor://` address, where a reload would only show it again.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const GAME_PUBLIC = new URL("../../game/public/", import.meta.url);
const RELOAD = `onclick="location.reload()"`;
const ICON = "images/game-pwa-192x192.png";

const { server } = JSON.parse(process.env.CAPACITOR_CONFIG);
const webDir = process.env.CAPACITOR_WEB_DIR;

const readGameOfflinePage = () => {
  const page = readFileSync(new URL("offline.html", GAME_PUBLIC), "utf8");
  if (page.split(RELOAD).length !== 2) throw new Error(`apps/game/public/offline.html no longer has one ${RELOAD}`);
  if (!page.includes(`src="/${ICON}"`)) throw new Error(`apps/game/public/offline.html no longer shows /${ICON}`);
  return page;
};

const writeWebFile = (path, write) => {
  mkdirSync(dirname(join(webDir, path)), { recursive: true });
  write(join(webDir, path));
};

const page = readGameOfflinePage().replace(RELOAD, `onclick="location.replace('${server.url}')"`);
writeWebFile(server.errorPath, (path) => writeFileSync(path, page));
writeWebFile(ICON, (path) => copyFileSync(new URL(ICON, GAME_PUBLIC), path));
