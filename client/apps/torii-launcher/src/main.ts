import { ChildProcessWithoutNullStreams } from "child_process";
import * as spawn from "cross-spawn";
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
import { osUtils } from "./utils/os-utils";

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
    await osUtils.removeDirectory(getDbPath());
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
  const toriiExecutable = osUtils.getExecutableName("torii");
  const toriiPath = path.join(DOJO_PATH, "bin", toriiExecutable);

  const hasTorii = hasbin.sync(toriiExecutable) || fs.existsSync(toriiPath);

  if (!hasTorii) {
    normalLog("torii not found, installing");
    try {
      await installTorii(toriiPath);
      normalLog("torii installed");

      // Verify installation was successful
      if (!fs.existsSync(toriiPath)) {
        throw new Error(`Torii executable not found at expected path: ${toriiPath}`);
      }
    } catch (error) {
      errorLog(`Failed to install Torii: ${error.message}`);
      sendNotification({
        type: "Error",
        message: `Torii installation failed: ${error.message}`,
      });

      // Suggest manual installation steps
      const manualInstructions =
        "Please try manual installation:\n" +
        "1. Open PowerShell as Administrator\n" +
        "2. Run: Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process\n" +
        "3. Run: Invoke-WebRequest -Uri https://install.dojoengine.org/install.ps1 -OutFile install.ps1\n" +
        "4. Run: ./install.ps1\n" +
        `5. Run: dojoup -v ${TORII_VERSION}\n` +
        "6. Restart the app";

      errorLog(manualInstructions);
      sendNotification({
        type: "Error",
        message: "Manual installation may be required. See console for instructions.",
      });

      // Wait before retrying
      await timeout(10000);
      return handleTorii(); // Retry after delay
    }
  } else {
    // Check current torii version
    const versionArgs = ["--version"];
    const versionResult = spawn.sync(toriiPath, versionArgs);
    const currentVersion = versionResult.stdout.toString().replace(/torii/g, "").replace(/\s+/g, "");

    if (currentVersion !== TORII_VERSION) {
      normalLog(`Updating torii from ${currentVersion} to ${TORII_VERSION}`);
      await installTorii(toriiPath);
      normalLog("torii updated");
    }
  }

  const toriiTomlPath = path.join(__dirname, "./torii/torii.toml");

  while (true) {
    const dbPath = getDbPath();
    mkdirSync(dbPath, { recursive: true });

    normalLog(
      `Launching torii with params:\n- network ${rpc.name}\n- rpc ${rpc.url}\n- db ${dbPath}\n- config ${toriiTomlPath}`,
    );

    child = spawn.spawn(toriiPath, [
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
      errorLog(`stderr: ${data}`);
      sendNotification({ type: "Error", message: data });
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

async function installTorii(toriiPath: string) {
  if (osUtils.isWindows()) {
    // Windows installation
    normalLog("Installing Torii on Windows...");

    // Create temporary directory for zip download
    const tempDir = path.join(app.getPath("temp"), "torii-temp");
    await fsPromises.mkdir(tempDir, { recursive: true });
    const zipPath = path.join(tempDir, "dojo.zip");

    // Download zip file
    const downloadUrl = `https://github.com/dojoengine/dojo/releases/download/v${TORII_VERSION}/dojo_v${TORII_VERSION}_win32_amd64.zip`;
    const result = spawn.sync("powershell", ["-c", `Invoke-WebRequest -Uri "${downloadUrl}" -OutFile "${zipPath}"`]);

    if (result.status !== 0) {
      const errorMsg = result.stderr ? result.stderr.toString() : "Unknown error";
      errorLog(`Windows download failed: ${errorMsg}`);
      throw new Error(`Download failed with code ${result.status}: ${errorMsg}`);
    }

    // Create bin directory if it doesn't exist
    await fsPromises.mkdir(path.join(DOJO_PATH, "bin"), { recursive: true });

    // Extract torii.exe from zip to the bin directory
    const extractResult = spawn.sync("powershell", [
      "-c",
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${tempDir}" -Force; ` +
        `Copy-Item -Path "${path.join(tempDir, "torii.exe")}" -Destination "${toriiPath}" -Force`,
    ]);

    if (extractResult.status !== 0) {
      const errorMsg = extractResult.stderr ? extractResult.stderr.toString() : "Unknown error";
      errorLog(`Windows extraction failed: ${errorMsg}`);
      throw new Error(`Extraction failed with code ${extractResult.status}: ${errorMsg}`);
    }

    // Cleanup temp directory
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  } else {
    // Unix-based installation (macOS, Linux)
    normalLog("Installing Torii on Unix-based system...");
    const result = spawn.sync("sh", [
      "-c",
      `curl -L https://install.dojoengine.org | bash && dojoup -v ${TORII_VERSION}`,
    ]);

    if (result.status !== 0) {
      const errorMsg = result.stderr ? result.stderr.toString() : "Unknown error";
      errorLog(`Unix installation failed: ${errorMsg}`);
      throw new Error(`Unix installation failed with code ${result.status}: ${errorMsg}`);
    }
  }

  normalLog("Torii installation completed successfully");
  sendNotification({ type: "Info", message: `Torii ${TORII_VERSION} installed successfully` });
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
  const stateFilePath = getStateFilePath();
  const exists = await osUtils.fileExists(stateFilePath);

  if (!exists) {
    warningLog("State file does not exist, creating...");
    await fsPromises.writeFile(stateFilePath, JSON.stringify({ firstBlock: null }));
  }

  const state = await fsPromises.readFile(stateFilePath, { encoding: "utf8", flag: "r" });
  const stateJson = JSON.parse(state);
  return stateJson.firstBlock;
}

async function getSavedRpc(): Promise<CurrentRpc> {
  const settings = await fsPromises.readFile(getSettingsFilePath(), "utf8");
  const settingsJson: CurrentRpc = JSON.parse(settings);
  return settingsJson;
}

async function saveRpc(rpc: CurrentRpc) {
  await osUtils.ensureDirectoryExists(ETERNUM_PATH);

  const settingsFilePath = getSettingsFilePath();
  const exists = await osUtils.fileExists(settingsFilePath);

  if (!exists) {
    warningLog("Settings file does not exist, creating...");
    await fsPromises.writeFile(settingsFilePath, JSON.stringify({ name: null, url: null }));
  }

  const settings = await fsPromises.readFile(settingsFilePath, "utf8");

  const settingsJson: CurrentRpc = JSON.parse(settings);
  settingsJson.name = rpc.name;
  settingsJson.url = rpc.url;
  settingsJson.worldBlock = rpc.worldBlock;

  await fsPromises.writeFile(settingsFilePath, JSON.stringify(settingsJson));
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
