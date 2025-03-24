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
import { DOJO_PATH } from "./constants";
import { ConfigType, IpcMethod, Notification, ToriiConfig } from "./types";
import { loadConfig, saveConfigType } from "./utils/config";
import {
  errorLog,
  getDbPath,
  getStateFilePath,
  getToriiTomlConfigPath,
  normalLog,
  osUtils,
  warningLog,
} from "./utils/os-utils";
import { getToriiVersion } from "./utils/torii";

// Declare Vite environment variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (require("electron-squirrel-startup") === true) app.quit();

if (started) {
  app.quit();
}

let child: ChildProcessWithoutNullStreams | null = null;
let config: ToriiConfig | null = null;

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
  const toriiVersion = await getToriiVersion();
  config = await loadConfig();

  await timeout(2000);
  sendNotification({ type: "Info", message: "Starting Torii" });
  window?.webContents.send(IpcMethod.ConfigWasChanged, config);
  handleTorii(toriiVersion);
};

app.on("quit", () => {
  killTorii();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  createWindow();

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
    // Kill Torii first
    killTorii();

    // Wait a moment for process to fully terminate
    await timeout(2000);

    // Then remove directory
    await osUtils.removeDirectory(getDbPath(config.configType));
    await resetFirstBlock(null, true);

    sendNotification({ type: "Info", message: "Database successfully reset" });
  } catch (e) {
    sendNotification({ type: "Error", message: "Failed to reset database: " + e });
  }
});

ipcMain.on(IpcMethod.ChangeConfigType, async (event, arg: ConfigType) => {
  try {
    await saveConfigType(arg);
    config = await loadConfig();
    killTorii();
    window?.webContents.send(IpcMethod.ConfigWasChanged, config);
    sendNotification({ type: "Info", message: "Config type successfully changed" });
  } catch (e) {
    sendNotification({ type: "Error", message: "Failed to change config type: " + e });
  }
});

async function handleTorii(toriiVersion: string) {
  const toriiExecutable = osUtils.getExecutableName("torii");
  const toriiPath = path.join(DOJO_PATH, "bin", toriiExecutable);

  const hasTorii = hasbin.sync(toriiExecutable) || fs.existsSync(toriiPath);

  if (!hasTorii) {
    normalLog("torii not found, installing");
    try {
      await installTorii(toriiPath, toriiVersion);
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

      await timeout(10000);
      return handleTorii(toriiVersion);
    }
  } else {
    // Check current torii version
    const versionArgs = ["--version"];
    const versionResult = spawn.sync(toriiPath, versionArgs);
    const currentVersion = `v${versionResult.stdout.toString().replace(/torii/g, "").replace(/\s+/g, "")}`;

    if (currentVersion !== toriiVersion) {
      normalLog(`Updating torii from ${currentVersion} to ${toriiVersion}`);
      await installTorii(toriiPath, toriiVersion);
      normalLog("torii updated");
    }
  }

  while (true) {
    try {
      const toriiTomlPath = getToriiTomlConfigPath(config.configType);

      const dbPath = getDbPath(config.configType);
      mkdirSync(dbPath, { recursive: true });

      normalLog(
        `Launching torii with params:\n- network ${config.configType}\n- rpc ${config.rpc}\n- world address ${config.world_address}\n- db ${dbPath}\n- config ${toriiTomlPath}`,
      );

      // Verify files exist before launching
      if (!fs.existsSync(toriiPath)) {
        throw new Error(`Torii executable not found at: ${toriiPath}`);
      }
      if (!fs.existsSync(toriiTomlPath)) {
        throw new Error(`Config file not found at: ${toriiTomlPath}`);
      }
      if (!fs.existsSync(dbPath)) {
        throw new Error(`Database directory not found at: ${dbPath}`);
      }

      child = spawn.spawn(toriiPath, ["--config", toriiTomlPath, "--db-dir", dbPath], {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (data: Buffer) => {
        // normalLog(`Torii stdout: ${data.toString()}`);
      });

      child.stderr.on("data", (data: Buffer) => {
        // errorLog(`Torii stderr: ${data.toString()}`);
        // sendNotification({ type: "Error", message: data.toString() });
      });

      let firstPass = true;

      // Wait for process to exit or be killed
      await new Promise<void>((resolve) => {
        child?.on("exit", (code, signal) => {
          errorLog(`Torii process exited with code ${code} and signal ${signal}`);
          resolve();
        });
        child?.on("error", (err) => {
          errorLog(`Torii process error: ${err}`);
          resolve();
        });
      });

      // Only proceed if child still exists
      if (child) {
        if (firstPass) {
          normalLog("Torii is running");
          sendNotification({ type: "Info", message: "Torii on " + config.configType });
          firstPass = false;
        }

        const exitCode = child.exitCode;
        child.removeAllListeners();

        if (exitCode !== 0 && exitCode !== 137) {
          errorLog(`Torii exited with code ${exitCode}`);
          sendNotification({
            type: "Error",
            message: `Torii exited with code ${exitCode}. Check console for details.`,
          });
        }
      }

      warningLog("Torii exited, waiting for 3s for ports to be released");
      await timeout(5000);
    } catch (error) {
      errorLog(`Error in handleTorii: ${error}`);
      sendNotification({ type: "Error", message: `Torii error: ${error}` });
      await timeout(3000); // Wait before retrying
    }
  }
}

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function installTorii(toriiPath: string, toriiVersion: string) {
  if (osUtils.isWindows()) {
    // Windows installation
    normalLog("Installing Torii on Windows...");

    // Create temporary directory for zip download
    const tempDir = path.join(app.getPath("temp"), "torii-temp");
    await fsPromises.mkdir(tempDir, { recursive: true });
    const zipPath = path.join(tempDir, "dojo.zip");

    // Download zip file
    const downloadUrl = `https://github.com/dojoengine/dojo/releases/download/${toriiVersion}/dojo_${toriiVersion}_win32_amd64.zip`;
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
      `curl -L https://install.dojoengine.org | bash && dojoup -v ${toriiVersion}`,
    ]);

    if (result.status !== 0) {
      const errorMsg = result.stderr ? result.stderr.toString() : "Unknown error";
      errorLog(`Unix installation failed: ${errorMsg}`);
      throw new Error(`Unix installation failed with code ${result.status}: ${errorMsg}`);
    }
  }

  normalLog("Torii installation completed successfully");
  sendNotification({ type: "Info", message: `Torii ${toriiVersion} installed successfully` });
}

function killTorii() {
  warningLog("Killing all torii processes");
  try {
    if (osUtils.isWindows()) {
      // On Windows, kill all torii.exe processes
      try {
        spawn.sync("taskkill", ["/f", "/im", "torii.exe"]);
      } catch (e) {
        // Ignore errors if no processes found
      }
    } else {
      // On Unix systems (Linux/MacOS), use pkill or killall
      try {
        // Try pkill first (more commonly available)
        spawn.sync("pkill", ["-9", "torii"]);
      } catch (e) {
        try {
          // Fallback to killall if pkill not available
          spawn.sync("killall", ["-9", "torii"]);
        } catch (e) {
          // Ignore errors if no processes found
        }
      }
    }
  } catch (error) {
    errorLog(`Error killing Torii processes: ${error}`);
    sendNotification({ type: "Error", message: `Failed to kill Torii processes: ${error}` });
  } finally {
    child = null;
    warningLog("Torii processes killed");
  }
}

async function resetFirstBlock(firstBlock: number | null, force: boolean = false) {
  const state = await fsPromises.readFile(getStateFilePath(config.configType), "utf8");
  const stateJson = JSON.parse(state);
  if (force || !stateJson.firstBlock) {
    stateJson.firstBlock = firstBlock;
    fs.writeFileSync(getStateFilePath(config.configType), JSON.stringify(stateJson));
  }
}

async function readFirstBlock() {
  const stateFilePath = getStateFilePath(config.configType);
  const exists = await osUtils.fileExists(stateFilePath);

  if (!exists) {
    warningLog("State file does not exist, creating...");
    await fsPromises.writeFile(stateFilePath, JSON.stringify({ firstBlock: null }));
  }

  const state = await fsPromises.readFile(stateFilePath, { encoding: "utf8", flag: "r" });
  const stateJson = JSON.parse(state);
  return stateJson.firstBlock;
}

async function sendNotification(notification: Notification) {
  console.log("Sending notification:", notification);
  window?.webContents.send(IpcMethod.Notification, notification);
}
