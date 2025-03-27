import { app } from "electron";
import path from "path";

export const HOME = app.getPath("home");
export const DOJO_PATH = path.join(HOME, ".dojo");
export const APP_PATH = path.join(app.getPath("appData"), "eternum");
