import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "child_process";
import { app, BrowserWindow, ipcMain } from "electron";
import started from "electron-squirrel-startup";
import * as fs from "fs";
import { mkdirSync } from "fs";
import * as fsPromises from "fs/promises";
import hasbin from "hasbin";
import path from "path";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";
import { TORII_VERSION, WORLD_ADDRESS } from "./constants";
import { CurrentRpc, IpcMethod, Notification, Rpc } from "./types";

if (started) {
  app.quit();
}

let child: ChildProcessWithoutNullStreams | null = null;
let rpc: CurrentRpc | null = null;

const HOME = app.getPath("home");
const DOJO_PATH = path.join(HOME, ".dojo");
const ETERNUM_PATH = path.join(app.getPath("userData"), "eternum");

const fontYellow = "\x1b[33m";
const fontReset = "\x1b[0m";
const fontRed = "\x1b[31m";
const fontNormal = "\x1b[34m";

updateElectronApp({
  updateSource: {
    type: UpdateSourceType.StaticStorage,
    baseUrl: `https://my-bucket.s3.amazonaws.com/my-app-updates/${process.platform}/${process.arch}`,
  },
});
let window: BrowserWindow | null = null;

const createWindow = () => {
  window = new BrowserWindow({
    width: 456,
    height: 316,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: true,
      devTools: !app.isPackaged,
    },
    center: true,
    title: "Eternum Launcher",
    icon: path.join(__dirname, "/icon.png"),
    frame: false,
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
  return window;
};

const runApp = async () => {
  createWindow();

  try {
    rpc = await getSavedRpc();
  } catch (e) {
    // if the settings file doesn't exist, we need to create the file and set the default rpc
    rpc = getDefaultRpc();
    await saveDefaultRpc();
  }
  await timeout(2000);
  window?.webContents.send(IpcMethod.RpcWasChanged, rpc);
  handleTorii();
};

app.on("quit", () => {
  killTorii();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  runApp();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on(IpcMethod.KillTorii, (event, arg) => {
  try {
    killTorii();
    sendNotification({ type: "Info", message: "Torii successfully killed" });
  } catch (e) {
    sendNotification({ type: "Error", message: "Failed to kill Torii: " + e });
  }
});

ipcMain.handle(IpcMethod.RequestFirstBlock, async (event, arg) => {
  if (arg) {
    errorLog("Arg should be empty");
    sendNotification({ type: "Error", message: "Arg should be empty" });
    return null;
  }

  try {
    const firstBlock = await readFirstBlock();
    return firstBlock;
  } catch (e) {
    sendNotification({ type: "Error", message: "Failed to read first block: " + e });
    return null;
  }
});

ipcMain.on(IpcMethod.SetFirstBlock, async (event, arg) => {
  try {
    await resetFirstBlock(arg, true);
    sendNotification({ type: "Info", message: "First block successfully set" });
  } catch (e) {
    sendNotification({ type: "Error", message: "Failed to set first block: " + e });
  }
});

ipcMain.on(IpcMethod.ResetDatabase, async (event, arg) => {
  try {
    spawnSync("rm", ["-rf", getDbPath()]);
    killTorii();
    await resetFirstBlock(null, true);
    sendNotification({ type: "Info", message: "Database successfully reset" });
  } catch (e) {
    sendNotification({ type: "Error", message: "Failed to reset database: " + e });
  }
});

ipcMain.on(IpcMethod.ChangeRpc, async (event, arg: CurrentRpc) => {
  try {
    await saveRpc(arg);
    rpc = arg;
    killTorii();
    sendNotification({ type: "Info", message: "RPC successfully changed" });
  } catch (e) {
    sendNotification({ type: "Error", message: "Failed to change RPC: " + e });
  }
});

async function handleTorii() {
  const hasTorii = hasbin.sync("torii");

  if (!hasTorii) {
    normalLog("torii not found, installing");
    await installTorii();
    normalLog("torii installed");
  } else {
    // Check current torii version
    const versionResult = spawnSync(path.join(DOJO_PATH, "bin", "torii"), ["--version"]);
    const currentVersion = versionResult.stdout.toString().replace(/torii/g, "").replace(/\s+/g, "");

    if (currentVersion !== TORII_VERSION) {
      normalLog(`Updating torii from ${currentVersion} to ${TORII_VERSION}`);
      await installTorii();
      normalLog("torii updated");
    }
  }

  const toriiTomlPath = path.join(__dirname, "./torii/torii.toml");

  while (true) {
    const dbPath = getDbPath();
    mkdirSync(dbPath, { recursive: true });

    const escapedToriiTomlPath = toriiTomlPath.replace(/ /g, "\\ ");

    normalLog(
      `Launching torii with params:\n- network ${rpc.name}\n- rpc ${rpc.url}\n- db ${dbPath}\n- config ${toriiTomlPath}`,
    );

    child = spawn(path.join(DOJO_PATH, "bin", "torii"), [
      "--world",
      WORLD_ADDRESS,
      "--http.cors_origins",
      "*",
      "--config",
      toriiTomlPath,
      "--db-dir",
      dbPath,
      "--rpc",
      rpc.url,
      "--indexing.world_block",
      rpc.worldBlock.toString(),
    ]);

    child.stdout.on("data", (data: any) => {
      //   console.log("data", data);
      //   normalLog(`stdout: ${data}`);
    });

    child.stderr.on("error", (data: any) => {
      //   console.log("data", data);
      //   errorLog(`stderr: ${data}`);
      //   sendNotification({ type: "error", message: data });
    });

    let firstPass = true;
    while (child.exitCode === null) {
      if (firstPass) {
        normalLog("Torii is running");
        sendNotification({ type: "Info", message: "Torii on " + rpc.name });
        firstPass = false;
      }
      await timeout(2000);
    }

    warningLog("Torii exited, waiting for 3s for ports to be released");
    await timeout(3000);

    if (child.exitCode !== 0 && child.exitCode !== 137) {
      errorLog(`Torii exited with code ${child.exitCode}`);
      sendNotification({ type: "Error", message: `Torii exited with code ${child.exitCode}` });
    }

    child.removeAllListeners();
  }
}

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function installTorii() {
  spawnSync("sh", ["-c", `curl -L https://install.dojoengine.org | bash && dojoup -v ${TORII_VERSION}`]);
}

function killTorii() {
  if (child) {
    warningLog("Killing torii");
    child.kill();
  } else {
    sendNotification({ type: "Error", message: "Couldn't kill Torii" });
  }
}

async function resetFirstBlock(firstBlock: number | null, force: boolean = false) {
  const state = await fsPromises.readFile(getStateFilePath(), "utf8");
  const stateJson = JSON.parse(state);
  if (force || !stateJson.firstBlock) {
    stateJson.firstBlock = firstBlock;
    fs.writeFileSync(getStateFilePath(), JSON.stringify(stateJson));
  }
}

async function readFirstBlock() {
  const exists = await fsPromises
    .access(getStateFilePath(), fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    warningLog("State file does not exist, creating...");
    await fsPromises.writeFile(getStateFilePath(), JSON.stringify({ firstBlock: null }));
  }

  const state = await fsPromises.readFile(getStateFilePath(), { encoding: "utf8", flag: "r" });
  const stateJson = JSON.parse(state);
  return stateJson.firstBlock;
}

async function getSavedRpc(): Promise<CurrentRpc> {
  const settings = await fsPromises.readFile(getSettingsFilePath(), "utf8");
  const settingsJson: CurrentRpc = JSON.parse(settings);
  return settingsJson;
}

async function saveRpc(rpc: CurrentRpc) {
  await fsPromises.mkdir(ETERNUM_PATH, { recursive: true });

  const exists = await fsPromises
    .access(getSettingsFilePath(), fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    warningLog("Settings file does not exist, creating...");
    await fsPromises.writeFile(getSettingsFilePath(), JSON.stringify({ name: null, url: null }));
  }

  const settings = await fsPromises.readFile(getSettingsFilePath(), "utf8");

  const settingsJson: CurrentRpc = JSON.parse(settings);
  settingsJson.name = rpc.name;
  settingsJson.url = rpc.url;
  settingsJson.worldBlock = rpc.worldBlock;

  await fsPromises.writeFile(getSettingsFilePath(), JSON.stringify(settingsJson));
}

async function saveDefaultRpc() {
  await saveRpc(getDefaultRpc());
}

function getDefaultRpc(): CurrentRpc {
  return { name: "Mainnet", url: Rpc.Mainnet.url, worldBlock: Rpc.Mainnet.worldBlock };
}

async function sendNotification(notification: Notification) {
  window?.webContents.send(IpcMethod.Notification, notification);
}

function getNetworkPath() {
  return path.join(ETERNUM_PATH, rpc.name.toLowerCase());
}

function getDbPath() {
  const dbPath = path.join(getNetworkPath(), "torii-db");
  return dbPath;
}

function getSettingsFilePath() {
  return path.join(ETERNUM_PATH, "settings.json");
}

function getStateFilePath() {
  return path.join(getNetworkPath(), "state.json");
}

function warningLog(message: string) {
  console.warn(`${fontYellow}${message}${fontReset}`);
}

function errorLog(message: string) {
  console.error(`${fontRed}${message}${fontReset}`);
}

function normalLog(message: string) {
  console.log(`${fontNormal}${message}${fontReset}`);
}
