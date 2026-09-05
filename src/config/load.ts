import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "./defaults.js";
import { interpolateDeep } from "./interpolate.js";
import { configPath, echoHome, expandHome } from "./paths.js";
import { echoConfigSchema, type EchoConfig } from "./schema.js";

export type LoadedConfig = {
  home: string;
  path: string;
  raw: EchoConfig;
  config: EchoConfig;
};

function expandConfigPaths(config: EchoConfig, home: string): EchoConfig {
  const voicePath = config.identity.voice.path;
  const filesRoot = config.tools.files.root;
  return {
    ...config,
    identity: {
      ...config.identity,
      voice: {
        ...config.identity.voice,
        path: voicePath ? expandHome(voicePath, home) : voicePath,
      },
    },
    tools: {
      ...config.tools,
      files: { ...config.tools.files, root: expandHome(filesRoot, home) },
    },
    plugins: config.plugins.map((entry) => expandHome(entry, home)),
  };
}

export async function loadConfig(homeOverride?: string): Promise<LoadedConfig> {
  const home = echoHome(homeOverride);
  const file = configPath(home);
  let parsed: unknown = defaultConfig();
  try {
    const text = await fs.readFile(file, "utf8");
    parsed = JSON.parse(text);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const raw = echoConfigSchema.parse(parsed);
  const interpolated = interpolateDeep(raw);
  return { home, path: file, raw, config: expandConfigPaths(interpolated, home) };
}

export async function writeDefaultConfig(homeOverride?: string): Promise<string> {
  const home = echoHome(homeOverride);
  const file = configPath(home);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(defaultConfig(), null, 2)}\n`, "utf8");
  return file;
}
