import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "child_process";
import { app, BrowserWindow, ipcMain } from "electron";
import started from "electron-squirrel-startup";
import fs from "fs";
import hasbin from "hasbin";
import path from "path";
import { IpcMethod } from "./types";
if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
    },
    center: true,
    title: "Eternum Launcher",
    icon: path.join(__dirname, "/icon.png"),
    frame: false,
    backgroundColor: "#0C0A089d",
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

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

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const installTorii = async () => {
  spawnSync("sh", ["-c", "curl -L https://install.dojoengine.org | bash && dojoup"]);
};

let child: ChildProcessWithoutNullStreams | null = null;

const home = app.getPath("home");
const dojoPath = path.join(home, ".dojo");
const dbPath = path.join(dojoPath, "eternum/torii-db");

const handleTorii = async () => {
  const hasTorii = hasbin.sync("torii");

  if (!hasTorii) {
    console.log("torii not found, installing");
    await installTorii();
    console.log("torii installed");
  }

  const toriiTomlPath = path.join(__dirname, "./torii.toml");
  console.log("toriiTomlPath", toriiTomlPath);

  while (true) {
    fs.mkdirSync(dbPath, { recursive: true });
    console.log("Launching torii");
    child = spawn(`${dojoPath}/bin/torii`, [
      "--world",
      "0x6a9e4c6f0799160ea8ddc43ff982a5f83d7f633e9732ce42701de1288ff705f",
      "--http.cors_origins",
      "*",
      "--config",
      toriiTomlPath,
      "--db-dir",
      dbPath,
    ]);

    child.stdout.on("data", (data: any) => {
      console.log(`stdout: ${data}`);
    });

    child.stderr.on("data", (data: any) => {
      console.error(`stderr: ${data}`);
    });

    while (child.exitCode === null) {
      console.log("Torii is still running");
      await timeout(10000);
    }
    child.removeAllListeners();

    console.log(`child process exited with code ${child.exitCode}`);
  }
};

handleTorii();

ipcMain.on(IpcMethod.KillTorii, (event, arg) => {
  killTorii();
});

const killTorii = () => {
  if (child) {
    child.kill();
  }
};

ipcMain.on(IpcMethod.ResetDatabase, (event, arg) => {
  const status = spawnSync("rm", ["-rf", dbPath]).status;
  console.log("status", status);
  killTorii();
});
