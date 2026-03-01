import { app, BrowserWindow } from "electron";
import path from "node:path";
import { startServer } from "./server";

const PORT = 13001;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "WarmPath",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Store the database in the OS-appropriate user data directory.
  const dbPath = path.join(app.getPath("userData"), "warmpath.db");
  process.env.WARMPATH_DB_PATH = dbPath;

  // Determine where the pre-built React client lives.
  const clientDistDir = app.isPackaged
    ? path.join(process.resourcesPath, "client")
    : path.resolve(__dirname, "../../client/dist");

  startServer(clientDistDir, PORT);
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
