import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("warmpath", {
  platform: process.platform,
});
