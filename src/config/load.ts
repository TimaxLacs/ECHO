import fs from "node:fs/promises";
import path from "node:path";
import { ZodError } from "zod";
import { collectSecrets } from "../util/redact.js";
import { loadEnvFiles } from "../util/env.js";
import { defaultConfig } from "./defaults.js";
import { interpolateDeep, mergeConfig } from "./interpolate.js";
import { configPath, echoHome, expandHome } from "./paths.js";
import { echoConfigSchema, type EchoConfig } from "./schema.js";

export type LoadedConfig = {
  home: string;
  path: string;
  raw: EchoConfig;
  config: EchoConfig;
  secrets: string[];
};

export async function loadConfig(homeOverride?: string): Promise<LoadedConfig> {
  loadEnvFiles();
  const home = echoHome(homeOverride);
  loadEnvFiles(home);
  const file = configPath(home);
  let fromDisk: unknown = {};
  try {
    fromDisk = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const raw = parseConfig(mergeConfig(defaultConfig(), fromDisk));
  const config = expandConfigPaths(parseConfig(interpolateDeep(raw)), home);
  return { home, path: file, raw, config, secrets: secretsOf(config) };
}

export function secretsOf(config: EchoConfig): string[] {
  return collectSecrets([
    ...Object.values(config.providers).map((provider) => provider.apiKey),
    process.env.GROQ_API_KEY,
    process.env.OPENROUTER_API_KEY,
    process.env.OPENAI_API_KEY,
  ]);
}

function parseConfig(value: unknown): EchoConfig {
  try {
    return echoConfigSchema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const detail = error.issues.map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`).join("; ");
      throw new Error(`Конфиг Эха не собран: ${detail}`);
    }
    throw error;
  }
}

function expandConfigPaths(config: EchoConfig, home: string): EchoConfig {
  const providers = Object.fromEntries(
    Object.entries(config.providers).map(([id, provider]) => [
      id,
      {
        ...provider,
        voicePath: provider.voicePath ? expandHome(provider.voicePath, home) : provider.voicePath,
      },
    ]),
  );
  return {
    ...config,
    identity: {
      ...config.identity,
      voice: {
        ...config.identity.voice,
        path: config.identity.voice.path ? expandHome(config.identity.voice.path, home) : undefined,
      },
    },
    providers,
    tools: {
      ...config.tools,
      files: { root: expandHome(config.tools.files.root, home) },
    },
  };
}

export async function ensureHome(home: string): Promise<void> {
  await fs.mkdir(path.join(home, "memory"), { recursive: true, mode: 0o700 });
  await fs.mkdir(path.join(home, "workspace"), { recursive: true, mode: 0o700 });
  await fs.mkdir(path.join(home, "voices"), { recursive: true, mode: 0o700 });
}
