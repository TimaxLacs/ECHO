import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EchoError } from "../kernel/types.js";
import type { EchoPlugin, EchoPluginApi } from "./api.js";

export async function loadPlugins(locations: string[], api: EchoPluginApi): Promise<string[]> {
  const loaded: string[] = [];
  for (const location of locations) {
    const files = await pluginFiles(location);
    for (const file of files) {
      const plugin = await importPlugin(file);
      await plugin(api);
      loaded.push(file);
    }
  }
  return loaded;
}

async function pluginFiles(location: string): Promise<string[]> {
  try {
    const stat = await fs.stat(location);
    if (stat.isFile()) return isPlugin(location) ? [location] : [];
    const entries = await fs.readdir(location);
    return entries.map((entry) => path.join(location, entry)).filter((file) => isPlugin(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function isPlugin(file: string): boolean {
  return file.endsWith(".mjs") || file.endsWith(".js") || file.endsWith(".echo-plugin.mjs");
}

async function importPlugin(file: string): Promise<EchoPlugin> {
  const mod = (await import(pathToFileURL(file).href)) as { default?: EchoPlugin; register?: EchoPlugin };
  const register = mod.default ?? mod.register;
  if (typeof register !== "function") {
    throw new EchoError("plugin_invalid", `${file}: нужен export default function register(api)`);
  }
  return register;
}
